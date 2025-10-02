#!/bin/bash
# Docker 安装完成后的部署脚本
# 在服务器上运行

set -e

PROJECT_DIR="${1:-~/english-listening-trainer}"

echo "=========================================="
echo "部署应用"
echo "=========================================="
echo "项目目录: $PROJECT_DIR"

# 1. 进入项目目录
if [ ! -d "$PROJECT_DIR" ]; then
  echo "错误：项目目录不存在: $PROJECT_DIR"
  echo "请先克隆项目："
  echo "  git clone <your-repo-url> $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

# 2. 拉取最新代码
echo "步骤 1: 拉取最新代码..."
git pull origin main

# 3. 检查环境变量
echo "步骤 2: 检查环境变量..."
if [ ! -f ".env.production" ]; then
  echo "创建 .env.production 文件..."
  cp .env.production.example .env.production
  echo ""
  echo "⚠️  请编辑 .env.production 文件，配置以下必需项："
  echo "  - CEREBRAS_API_KEY"
  echo "  - JWT_SECRET (运行: openssl rand -hex 32)"
  echo "  - ADMIN_EMAIL"
  echo "  - ADMIN_PASSWORD"
  echo ""
  echo "编辑完成后，重新运行此脚本"
  exit 0
fi

# 4. 创建必需目录
echo "步骤 3: 创建必需目录..."
mkdir -p data public/audio logs backups

# 5. 设置 Kokoro TTS 环境
echo "步骤 4: 设置 TTS 环境..."
if [ -f "scripts/setup-kokoro-complete.sh" ]; then
  ./scripts/setup-kokoro-complete.sh
else
  echo "⚠️  TTS 设置脚本不存在，跳过"
fi

# 6. 停止旧服务
echo "步骤 5: 停止旧服务..."
docker compose -f docker-compose.gpu.yml down 2>/dev/null || true

# 7. 构建镜像
echo "步骤 6: 构建 Docker 镜像..."
docker compose -f docker-compose.gpu.yml build app

# 8. 运行数据库迁移
echo "步骤 7: 运行数据库迁移..."
docker compose -f docker-compose.gpu.yml run --rm migrate

# 9. 启动服务
echo "步骤 8: 启动服务..."
docker compose -f docker-compose.gpu.yml up -d app

# 10. 等待服务启动
echo "步骤 9: 等待服务启动..."
sleep 10

# 11. 检查服务状态
echo "步骤 10: 检查服务状态..."
docker compose -f docker-compose.gpu.yml ps

# 12. 健康检查
echo "步骤 11: 健康检查..."
if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "✓ 应用健康检查通过"
else
  echo "✗ 应用健康检查失败"
  echo "查看日志："
  echo "  docker compose -f docker-compose.gpu.yml logs -f app"
fi

echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "访问地址: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "常用命令："
echo "  查看日志: docker compose -f docker-compose.gpu.yml logs -f app"
echo "  重启服务: docker compose -f docker-compose.gpu.yml restart"
echo "  停止服务: docker compose -f docker-compose.gpu.yml down"
echo "  查看状态: docker compose -f docker-compose.gpu.yml ps"
