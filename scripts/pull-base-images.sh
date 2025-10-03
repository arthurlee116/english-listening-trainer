#!/bin/bash
# 拉取基础 Docker 镜像

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "📥 拉取基础 Docker 镜像..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
set -e

echo "🔍 检查 Docker 状态..."
docker info > /dev/null 2>&1 || {
    echo "❌ Docker 未运行，尝试启动..."
    sudo systemctl start docker
    sleep 3
}

echo ""
echo "📥 拉取 ubuntu:22.04 镜像..."
docker pull ubuntu:22.04

echo ""
echo "📥 拉取 node:20-slim 镜像（如果需要）..."
docker pull node:20-slim || true

echo ""
echo "✅ 基础镜像拉取完成"

echo ""
echo "📦 当前镜像列表："
docker images

echo ""
echo "💾 磁盘使用情况："
df -h / | head -2
ENDSSH

echo ""
echo "✅ 完成！现在可以重新构建了"
