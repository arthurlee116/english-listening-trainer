#!/bin/bash
# 重新构建并重启服务

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🔨 重新构建 Docker 镜像..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "⏸️  停止服务..."
docker compose -f docker-compose.gpu.yml down

echo ""
echo "🔨 重新构建镜像..."
docker compose -f docker-compose.gpu.yml build app

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
echo "📋 最近日志："
docker compose -f docker-compose.gpu.yml logs --tail=50 app
ENDSSH

echo ""
echo "✅ 重新构建完成"
echo ""
echo "💡 查看实时日志："
echo "   ./scripts/remote-logs.sh"
