#!/bin/bash
# 远程服务器磁盘空间清理脚本

set -e

# 配置
REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
REMOTE_DIR="~/english-listening-trainer"

echo "🧹 远程服务器磁盘空间清理..."

# 1. 上传清理脚本
echo ""
echo "📤 上传清理脚本..."
scp -P ${REMOTE_PORT} scripts/cleanup-docker-space.sh ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/

# 2. 在远程服务器上执行清理
echo ""
echo "🔧 在远程服务器上执行清理..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} << 'ENDSSH'
cd ~/english-listening-trainer

# 赋予执行权限
chmod +x scripts/cleanup-docker-space.sh

# 显示当前磁盘状态
echo "📊 清理前磁盘状态："
df -h /

echo ""
echo "📦 清理前 Docker 状态："
docker system df || true

echo ""
echo "🗑️  开始清理..."

# 停止当前服务
echo "⏸️  停止服务..."
docker compose -f docker-compose.gpu.yml down || true

# 清理 Docker
echo "🧹 清理 Docker..."
docker container prune -f || true
docker image prune -a -f || true
docker volume prune -f || true
docker builder prune -a -f || true
docker network prune -f || true

# 清理系统缓存
echo "🧹 清理系统缓存..."
sudo apt-get clean || true
sudo journalctl --vacuum-time=3d || true

# 清理旧的音频文件
echo "🧹 清理旧的音频文件..."
find ~/english-listening-trainer/public/audio -name "*.wav" -mtime +7 -delete 2>/dev/null || true

# 清理旧的日志
echo "🧹 清理旧的日志..."
find ~/english-listening-trainer/logs -name "*.log" -mtime +7 -delete 2>/dev/null || true

# 清理旧的备份
echo "🧹 清理旧的备份..."
find ~/english-listening-trainer/backups -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true

echo ""
echo "📊 清理后磁盘状态："
df -h /

echo ""
echo "📦 清理后 Docker 状态："
docker system df || true

echo ""
echo "✅ 清理完成！"
ENDSSH

echo ""
echo "✅ 远程清理完成！"
echo ""
echo "💡 下一步："
echo "   1. 检查磁盘空间是否足够（建议至少 10GB 可用）"
echo "   2. 如果空间足够，重新运行部署："
echo "      ./scripts/remote-optimize-gpu.sh"
