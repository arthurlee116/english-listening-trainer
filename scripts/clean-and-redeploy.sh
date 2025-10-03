#!/bin/bash
# 清理服务器上的旧文件并重新部署

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🧹 清理并重新部署..."
echo ""

# 1. 清理服务器上的旧 Python wrapper
echo "📤 步骤 1/5: 清理服务器上的旧文件..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "🗑️  删除所有 Python wrapper..."
find kokoro-local -name "kokoro_wrapper*.py" -type f -delete 2>/dev/null || true
find kokoro-local -name "*.pyc" -type f -delete 2>/dev/null || true
find kokoro-local -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✅ 清理完成"
ENDSSH

# 2. 上传最新的文件
echo ""
echo "📤 步骤 2/5: 上传最新文件..."
scp -P ${REMOTE_PORT} kokoro-local/kokoro_wrapper_real.py ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/kokoro-local/
scp -P ${REMOTE_PORT} .env.production ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/

echo "✅ 文件上传完成"

# 3. 验证文件
echo ""
echo "📤 步骤 3/5: 验证文件..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "📄 Python wrapper 文件："
ls -lh kokoro-local/kokoro_wrapper*.py

echo ""
echo "📄 环境配置："
grep -E "HF_HUB_OFFLINE|PROXY" .env.production | head -5
ENDSSH

# 4. 停止服务
echo ""
echo "📤 步骤 4/5: 停止服务..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer
docker compose -f docker-compose.gpu.yml down
ENDSSH

# 5. 重新构建并启动
echo ""
echo "📤 步骤 5/5: 重新构建并启动..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "🔨 重新构建镜像（这可能需要几分钟）..."
docker compose -f docker-compose.gpu.yml build --no-cache app

echo ""
echo "🚀 启动服务..."
docker compose -f docker-compose.gpu.yml up -d app

echo ""
echo "⏳ 等待服务启动（30秒）..."
sleep 30

echo ""
echo "📊 服务状态："
docker compose -f docker-compose.gpu.yml ps app

echo ""
echo "📋 启动日志（最后 50 行）："
docker compose -f docker-compose.gpu.yml logs --tail=50 app
ENDSSH

echo ""
echo "✅ 清理和重新部署完成！"
echo ""
echo "💡 查看实时日志："
echo "   ./scripts/remote-logs.sh"
echo ""
echo "💡 检查服务状态："
echo "   ./scripts/remote-status.sh"
