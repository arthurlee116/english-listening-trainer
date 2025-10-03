#!/bin/bash
# 重启远程服务

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🔄 重启服务..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "⏸️  停止服务..."
docker compose -f docker-compose.gpu.yml stop app

echo ""
echo "🚀 启动服务..."
docker compose -f docker-compose.gpu.yml start app

echo ""
echo "⏳ 等待服务启动..."
sleep 5

echo ""
echo "📊 服务状态："
docker compose -f docker-compose.gpu.yml ps app

echo ""
echo "📋 最近日志："
docker compose -f docker-compose.gpu.yml logs --tail=30 app
ENDSSH

echo ""
echo "✅ 重启完成"
echo ""
echo "💡 查看实时日志："
echo "   ./scripts/remote-logs.sh"
