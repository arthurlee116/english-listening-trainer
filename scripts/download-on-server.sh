#!/bin/bash
# 直接在服务器上下载 Kokoro 模型（使用代理）

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
PROXY="http://81.71.93.183:10811"

echo "🚀 在服务器上直接下载 Kokoro 模型..."
echo "🌐 使用代理: $PROXY"
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << ENDSSH
set -e

# 配置代理
export http_proxy="$PROXY"
export https_proxy="$PROXY"
export HTTP_PROXY="$PROXY"
export HTTPS_PROXY="$PROXY"

CACHE_DIR="\$HOME/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
MODEL_DIR="\$CACHE_DIR/snapshots/main"

echo "📁 创建目录..."
mkdir -p "\$MODEL_DIR"
mkdir -p "\$CACHE_DIR/refs"

cd "\$MODEL_DIR"

echo ""
echo "📥 下载模型文件..."
echo ""

# 下载主模型文件
echo "1/2 下载 kokoro-v1_0.pth (约 82MB)..."
wget --progress=bar:force \
    -c https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth \
    -O kokoro-v1_0.pth.tmp && mv kokoro-v1_0.pth.tmp kokoro-v1_0.pth

echo ""
echo "2/2 下载 VOICES.md..."
wget --progress=bar:force \
    -c https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/VOICES.md \
    -O VOICES.md.tmp && mv VOICES.md.tmp VOICES.md

# 创建 refs
echo "main" > "\$CACHE_DIR/refs/main"

echo ""
echo "✅ 下载完成！"
echo ""
echo "📊 模型信息："
du -sh "\$CACHE_DIR"
echo ""
echo "📄 文件列表："
ls -lh "\$MODEL_DIR"

ENDSSH

echo ""
echo "✅ 服务器端下载完成！"
echo ""
echo "💡 下一步："
echo "   重新启动服务："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml restart app'"
