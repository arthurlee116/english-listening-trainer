#!/bin/bash
# Docker 磁盘空间清理脚本
# 清理未使用的镜像、容器、卷和构建缓存

set -e

echo "🧹 开始清理 Docker 磁盘空间..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 显示当前磁盘使用情况
echo ""
echo "📊 当前磁盘使用情况："
df -h / | grep -v Filesystem

echo ""
echo "📦 Docker 磁盘使用情况："
docker system df

echo ""
echo -e "${YELLOW}⚠️  即将清理以下内容：${NC}"
echo "  - 停止的容器"
echo "  - 未使用的镜像"
echo "  - 未使用的卷"
echo "  - 构建缓存"
echo "  - 悬空镜像（dangling images）"

echo ""
read -p "确认继续？[y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "🗑️  清理停止的容器..."
docker container prune -f

echo ""
echo "🗑️  清理未使用的镜像..."
docker image prune -a -f

echo ""
echo "🗑️  清理未使用的卷..."
docker volume prune -f

echo ""
echo "🗑️  清理构建缓存..."
docker builder prune -a -f

echo ""
echo "🗑️  清理未使用的网络..."
docker network prune -f

echo ""
echo -e "${GREEN}✅ 清理完成！${NC}"

echo ""
echo "📊 清理后磁盘使用情况："
df -h / | grep -v Filesystem

echo ""
echo "📦 清理后 Docker 磁盘使用："
docker system df

echo ""
echo "💡 提示："
echo "  - 如果空间仍然不足，可以考虑："
echo "    1. 删除旧的备份文件"
echo "    2. 清理系统日志：sudo journalctl --vacuum-time=3d"
echo "    3. 清理 apt 缓存：sudo apt-get clean"
echo "    4. 检查大文件：du -sh /* 2>/dev/null | sort -h"
