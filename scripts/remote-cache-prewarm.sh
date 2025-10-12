#!/bin/bash
# 远程服务器缓存预热脚本
# 按顺序拉取多级缓存层，确保部署时只需下载业务层

set -e

# 远程服务器配置
REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

# 镜像仓库配置
REGISTRY="ghcr.io"
IMAGE_NAME="arthurlee116/english-listening-trainer"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔥 开始远程缓存预热...${NC}"
echo -e "${BLUE}📦 目标镜像: $REGISTRY/$IMAGE_NAME${NC}"
echo ""

# 缓存层列表（按依赖顺序）
CACHE_LAYERS=(
    "cache-base"
    "cache-python" 
    "cache-node"
)

# 执行远程缓存预热
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 检查Docker状态...${NC}"
docker info > /dev/null 2>&1 || {
    echo -e "${RED}❌ Docker未运行，尝试启动...${NC}"
    sudo systemctl start docker
    sleep 3
}

echo ""
echo -e "${BLUE}🧹 清理未使用的镜像（保留缓存层）...${NC}"
docker image prune -f --filter "label!=cache-layer" || true

echo ""
echo -e "${BLUE}📊 当前磁盘使用情况：${NC}"
df -h / | head -2

# 缓存层列表
CACHE_LAYERS=(
    "cache-base"
    "cache-python"
    "cache-node"
)

REGISTRY="ghcr.io"
IMAGE_NAME="arthurlee116/english-listening-trainer"

# 按顺序拉取缓存层
for layer in "${CACHE_LAYERS[@]}"; do
    echo ""
    echo -e "${YELLOW}📥 拉取缓存层: $layer${NC}"
    
    if docker pull "$REGISTRY/$IMAGE_NAME:$layer"; then
        echo -e "${GREEN}✅ 成功拉取: $layer${NC}"
        
        # 标记为缓存层，避免被清理
        docker tag "$REGISTRY/$IMAGE_NAME:$layer" "$REGISTRY/$IMAGE_NAME:$layer-temp" 2>/dev/null || true
        docker tag "$REGISTRY/$IMAGE_NAME:$layer-temp" "$REGISTRY/$IMAGE_NAME:$layer" 2>/dev/null || true
        docker rmi "$REGISTRY/$IMAGE_NAME:$layer-temp" 2>/dev/null || true
    else
        echo -e "${RED}❌ 拉取失败: $layer${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}🎉 缓存预热完成！${NC}"
echo ""
echo -e "${BLUE}📦 当前缓存镜像：${NC}"
docker images | grep "$IMAGE_NAME" | grep -E "(cache-|latest)" || echo "未找到缓存镜像"

echo ""
echo -e "${BLUE}💾 磁盘使用情况：${NC}"
df -h / | head -2
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 远程缓存预热成功完成${NC}"
    echo -e "${BLUE}💡 现在可以运行 deploy-from-ghcr.sh 进行快速部署${NC}"
else
    echo ""
    echo -e "${RED}❌ 远程缓存预热失败${NC}"
    exit 1
fi