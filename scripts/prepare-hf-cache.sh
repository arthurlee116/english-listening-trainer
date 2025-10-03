#!/bin/bash
# 准备 HuggingFace 缓存目录
# 确保模型文件已下载并可用

set -e

echo "🔍 检查 HuggingFace 缓存..."

CACHE_DIR="./kokoro-local/.cache/huggingface"
HUB_DIR="${CACHE_DIR}/hub"
MODEL_REPO="models--hexgrad--Kokoro-82M"

# 创建缓存目录
mkdir -p "${CACHE_DIR}"
mkdir -p "${HUB_DIR}"

echo "📁 缓存目录: ${CACHE_DIR}"

# 检查模型是否已缓存
if [ -d "${HUB_DIR}/${MODEL_REPO}" ]; then
    echo "✅ 模型已缓存: ${MODEL_REPO}"
    
    # 显示缓存大小
    CACHE_SIZE=$(du -sh "${HUB_DIR}/${MODEL_REPO}" | cut -f1)
    echo "📊 缓存大小: ${CACHE_SIZE}"
    
    # 显示文件列表
    echo ""
    echo "📄 缓存文件:"
    find "${HUB_DIR}/${MODEL_REPO}" -type f -name "*.bin" -o -name "*.safetensors" -o -name "config.json" | head -10
else
    echo "⚠️  模型未缓存，首次运行时会自动下载"
    echo "   这可能需要 3-5 分钟，取决于网络速度"
fi

# 设置权限（确保 Docker 容器可以访问）
echo ""
echo "🔧 设置缓存目录权限..."
chmod -R 755 "${CACHE_DIR}" 2>/dev/null || true

echo ""
echo "✅ 缓存准备完成"
