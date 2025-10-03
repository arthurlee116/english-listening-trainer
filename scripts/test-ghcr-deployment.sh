#!/bin/bash
# 测试 GHCR 镜像部署脚本
# 用于在 GPU 服务器上测试从 GitHub Container Registry 拉取和部署镜像

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# 配置
GHCR_IMAGE="ghcr.io/arthurlee116/english-listening-trainer:latest"
GITHUB_USERNAME="arthurlee116"

echo "=========================================="
echo "  GHCR 部署测试脚本"
echo "=========================================="
echo ""

# Step 1: 检查 Docker 是否安装
log_info "Step 1: 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装"
    exit 1
fi
log_success "Docker 已安装: $(docker --version)"

# Step 2: 检查 Docker Compose
if ! command -v docker compose &> /dev/null; then
    log_error "Docker Compose 未安装"
    exit 1
fi
log_success "Docker Compose 已安装"

# Step 3: 检查 NVIDIA Docker Runtime
log_info "Step 2: 检查 GPU 支持..."
if docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi &> /dev/null; then
    log_success "NVIDIA Docker Runtime 正常"
else
    log_warn "NVIDIA Docker Runtime 可能未正确配置"
fi

# Step 4: 检查是否已登录 GHCR
log_info "Step 3: 检查 GHCR 认证状态..."
if docker info 2>/dev/null | grep -q "ghcr.io"; then
    log_success "已登录到 GHCR"
else
    log_warn "未登录到 GHCR"
    echo ""
    echo "请按照以下步骤登录 GHCR："
    echo "1. 创建 GitHub Personal Access Token (PAT):"
    echo "   - 访问: https://github.com/settings/tokens"
    echo "   - 点击 'Generate new token (classic)'"
    echo "   - 选择 'read:packages' 权限"
    echo "   - 生成并复制 token"
    echo ""
    echo "2. 登录到 GHCR:"
    echo "   docker login ghcr.io -u ${GITHUB_USERNAME}"
    echo "   (输入 PAT 作为密码)"
    echo ""
    read -p "是否现在登录? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker login ghcr.io -u ${GITHUB_USERNAME}
        if [ $? -eq 0 ]; then
            log_success "登录成功"
        else
            log_error "登录失败"
            exit 1
        fi
    else
        log_error "需要登录才能继续"
        exit 1
    fi
fi

# Step 5: 测试拉取镜像
log_info "Step 4: 测试拉取 GHCR 镜像..."
echo "镜像: ${GHCR_IMAGE}"
if docker pull ${GHCR_IMAGE}; then
    log_success "镜像拉取成功"
else
    log_error "镜像拉取失败"
    exit 1
fi

# Step 6: 检查镜像信息
log_info "Step 5: 检查镜像信息..."
docker images ${GHCR_IMAGE}
echo ""
docker inspect ${GHCR_IMAGE} --format='镜像大小: {{.Size}} bytes'
docker inspect ${GHCR_IMAGE} --format='创建时间: {{.Created}}'
docker inspect ${GHCR_IMAGE} --format='架构: {{.Architecture}}'

# Step 7: 检查镜像标签
log_info "Step 6: 检查镜像标签..."
docker inspect ${GHCR_IMAGE} --format='{{json .Config.Labels}}' | jq '.'

# Step 8: 检查项目文件
log_info "Step 7: 检查项目配置..."
if [ ! -f "docker-compose.gpu.yml" ]; then
    log_error "docker-compose.gpu.yml 不存在"
    exit 1
fi
log_success "docker-compose.gpu.yml 存在"

if [ ! -f ".env.production" ]; then
    log_warn ".env.production 不存在，需要创建"
else
    log_success ".env.production 存在"
fi

# Step 9: 验证 docker-compose 配置
log_info "Step 8: 验证 docker-compose 配置..."
if docker compose -f docker-compose.gpu.yml config > /dev/null 2>&1; then
    log_success "docker-compose 配置有效"
else
    log_error "docker-compose 配置无效"
    exit 1
fi

# Step 10: 准备部署
echo ""
echo "=========================================="
echo "  准备就绪！"
echo "=========================================="
echo ""
log_success "所有检查通过"
echo ""
echo "下一步操作："
echo "1. 确保 .env.production 文件配置正确"
echo "2. 运行部署脚本:"
echo "   ./scripts/deploy-from-ghcr.sh"
echo ""
echo "或者手动部署:"
echo "   docker compose -f docker-compose.gpu.yml pull"
echo "   docker compose -f docker-compose.gpu.yml up -d"
echo ""
read -p "是否现在部署? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "开始部署..."
    
    # 备份数据库
    if [ -f "data/app.db" ]; then
        log_info "备份数据库..."
        cp data/app.db data/app.db.backup.$(date +%Y%m%d_%H%M%S)
        log_success "数据库已备份"
    fi
    
    # 拉取最新镜像
    log_info "拉取最新镜像..."
    docker compose -f docker-compose.gpu.yml pull
    
    # 停止旧容器
    log_info "停止旧容器..."
    docker compose -f docker-compose.gpu.yml down
    
    # 启动新容器
    log_info "启动新容器..."
    docker compose -f docker-compose.gpu.yml up -d
    
    # 等待启动
    log_info "等待服务启动..."
    sleep 10
    
    # 检查状态
    log_info "检查服务状态..."
    docker compose -f docker-compose.gpu.yml ps
    
    # 检查健康状态
    log_info "检查健康状态..."
    sleep 5
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_success "健康检查通过"
    else
        log_warn "健康检查失败，查看日志:"
        docker compose -f docker-compose.gpu.yml logs --tail=50
    fi
    
    echo ""
    log_success "部署完成！"
    echo ""
    echo "查看日志: docker compose -f docker-compose.gpu.yml logs -f"
    echo "访问应用: http://49.234.30.246:3000"
else
    log_info "取消部署"
fi
