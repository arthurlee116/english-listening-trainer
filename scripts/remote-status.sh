#!/bin/bash
# 查看远程服务器状态

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "📊 服务器状态检查..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "🐳 Docker 服务状态："
docker compose -f docker-compose.gpu.yml ps

echo ""
echo "💾 磁盘使用："
df -h / | head -2

echo ""
echo "🧠 内存使用："
free -h

echo ""
echo "🎮 GPU 状态："
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader

echo ""
echo "📊 最近日志（最后 20 行）："
docker compose -f docker-compose.gpu.yml logs --tail=20 app | tail -20
ENDSSH
