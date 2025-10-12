#!/bin/bash
# 缓存层验证脚本
# 验证缓存层是否正确下载和可用

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

echo -e "${BLUE}🔍 验证缓存层状态...${NC}"
echo -e "${BLUE}📦 目标镜像: $REGISTRY/$IMAGE_NAME${NC}"
echo ""

# 缓存层列表
CACHE_LAYERS=(
    "cache-base"
    "cache-python"
    "cache-node"
)

# 执行远程验证
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
    echo -e "${RED}❌ Docker未运行${NC}"
    exit 1
}

echo ""
echo -e "${BLUE}📊 验证缓存层：${NC}"

# 缓存层列表
CACHE_LAYERS=(
    "cache-base"
    "cache-python"
    "cache-node"
)

REGISTRY="ghcr.io"
IMAGE_NAME="arthurlee116/english-listening-trainer"

ALL_VALID=true

for layer in "${CACHE_LAYERS[@]}"; do
    echo -n "📋 检查 $layer: "
    
    if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "$IMAGE_NAME:$layer"; then
        echo -e "${GREEN}✅ 已存在${NC}"
        
        # 检查镜像大小
        SIZE=$(docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "$IMAGE_NAME:$layer" | awk '{print $2}')
        echo "   📏 大小: $SIZE"
        
        # 检查创建时间
        CREATED=$(docker images --format "{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep "$IMAGE_NAME:$layer" | awk '{print $2,$3,$4,$5}')
        echo "   📅 创建: $CREATED"
    else
        echo -e "${RED}❌ 缺失${NC}"
        ALL_VALID=false
    fi
done

echo ""
if [ "$ALL_VALID" = true ]; then
    echo -e "${GREEN}🎉 所有缓存层验证通过！${NC}"
    echo -e "${BLUE}💡 可以安全进行部署，只需下载业务层${NC}"
else
    echo -e "${RED}❌ 缓存层不完整，请先运行缓存预热${NC}"
    echo -e "${YELLOW}💡 运行命令: ./scripts/remote-cache-prewarm.sh${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📦 当前相关镜像列表：${NC}"
docker images | grep "$IMAGE_NAME" | grep -E "(cache-|latest)" || echo "未找到相关镜像"

echo ""
echo -e "${BLUE}💾 磁盘使用情况：${NC}"
df -h / | head -2
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 缓存层验证完成${NC}"
else
    echo ""
    echo -e "${RED}❌ 缓存层验证失败${NC}"
    exit 1
fi