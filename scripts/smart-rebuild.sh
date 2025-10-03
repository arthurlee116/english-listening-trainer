#!/bin/bash
# 智能重建脚本 - 只在代码变化时重建

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🔨 智能重建..."
echo ""

# 检查是否需要完全重建
if [ "$1" = "--force" ]; then
    echo "⚠️  强制完全重建（使用 --no-cache）"
    NO_CACHE="--no-cache"
else
    echo "✅ 使用缓存加速构建"
    NO_CACHE=""
fi

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << ENDSSH
cd ~/english-listening-trainer

echo "⏸️  停止服务..."
docker compose -f docker-compose.gpu.yml down

echo ""
echo "🔨 重新构建镜像..."
docker compose -f docker-compose.gpu.yml build ${NO_CACHE} app

echo ""
echo "🚀 启动服务..."
docker compose -f docker-compose.gpu.yml up -d app

echo ""
echo "⏳ 等待 30 秒..."
sleep 30

echo ""
echo "📊 服务状态："
docker compose -f docker-compose.gpu.yml ps app

echo ""
echo "📋 启动日志："
docker compose -f docker-compose.gpu.yml logs --tail=50 app
ENDSSH

echo ""
echo "✅ 完成！"
echo ""
echo "💡 提示："
echo "   - 正常重建：./scripts/smart-rebuild.sh"
echo "   - 强制重建：./scripts/smart-rebuild.sh --force"
echo "   - 查看日志：./scripts/remote-logs.sh"
