#!/bin/bash
# GPU TTS 优化脚本
# 用于优化 Tesla P40 的 TTS 性能

set -e

echo "🚀 优化 GPU TTS 配置..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查是否在远程服务器上
if [ -f "/proc/driver/nvidia/version" ]; then
    echo -e "${GREEN}✅ 检测到 NVIDIA GPU${NC}"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
else
    echo -e "${YELLOW}⚠️  未检测到 NVIDIA GPU，跳过 GPU 优化${NC}"
    exit 0
fi

# 1. 确保基础镜像可用
echo ""
echo "📥 拉取基础镜像..."
docker pull ubuntu:22.04 || {
    echo -e "${RED}❌ 无法拉取基础镜像${NC}"
    exit 1
}

# 2. 重新构建并重启服务
echo ""
echo "📦 重新构建 Docker 镜像..."
docker compose -f docker-compose.gpu.yml build --no-cache app

echo ""
echo "🔄 重启服务..."
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml up -d

echo ""
echo "⏳ 等待服务启动（这可能需要 5-10 分钟，因为需要加载模型到 GPU）..."
echo "   提示：首次启动会下载和加载模型到显存，请耐心等待"

# 2. 监控启动日志
echo ""
echo "📊 监控启动日志（按 Ctrl+C 停止）..."
docker compose -f docker-compose.gpu.yml logs -f app &
LOG_PID=$!

# 3. 等待服务就绪
MAX_WAIT=600  # 10分钟
WAIT_TIME=0
READY=false

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if docker compose -f docker-compose.gpu.yml logs app 2>&1 | grep -q "service is ready"; then
        READY=true
        break
    fi
    
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
    
    # 每30秒显示一次进度
    if [ $((WAIT_TIME % 30)) -eq 0 ]; then
        echo -e "${YELLOW}⏳ 已等待 ${WAIT_TIME}s / ${MAX_WAIT}s...${NC}"
    fi
done

# 停止日志监控
kill $LOG_PID 2>/dev/null || true

if [ "$READY" = true ]; then
    echo ""
    echo -e "${GREEN}✅ TTS 服务已就绪！${NC}"
    echo ""
    echo "📊 GPU 状态："
    docker compose -f docker-compose.gpu.yml exec app nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total --format=csv,noheader
    
    echo ""
    echo "🎯 优化完成！现在可以测试 TTS 性能了"
    echo ""
    echo "💡 提示："
    echo "   - 首次生成会慢一些（模型初始化）"
    echo "   - 后续生成会很快（模型已在显存中）"
    echo "   - 可以同时处理 8 个并发请求"
    echo ""
    echo "📝 查看实时日志："
    echo "   docker compose -f docker-compose.gpu.yml logs -f app"
else
    echo ""
    echo -e "${RED}❌ 服务启动超时${NC}"
    echo ""
    echo "🔍 最近的日志："
    docker compose -f docker-compose.gpu.yml logs --tail=50 app
    exit 1
fi
