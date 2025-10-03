#!/bin/bash
# 下载完整的 Kokoro 模型（包括所有配置文件）

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
PROXY="http://81.71.93.183:10811"

echo "🚀 下载完整的 Kokoro 模型..."
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
echo "📥 下载所有模型文件..."
echo ""

# 下载所有文件
FILES=(
    "kokoro-v1_0.pth"
    "VOICES.md"
    "README.md"
    ".gitattributes"
)

for file in "\${FILES[@]}"; do
    if [ -f "\$file" ]; then
        echo "⏭️  跳过已存在: \$file"
        continue
    fi
    
    echo "📥 下载: \$file"
    wget --progress=bar:force \
        -c "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/\$file" \
        -O "\$file.tmp" && mv "\$file.tmp" "\$file" || echo "⚠️  \$file 下载失败（可能不存在）"
    echo ""
done

# 创建 refs
echo "main" > "\$CACHE_DIR/refs/main"

# 创建一个简单的 config.json（如果 Kokoro 需要）
if [ ! -f "config.json" ]; then
    echo "📝 创建 config.json..."
    cat > config.json << 'EOF'
{
  "model_type": "kokoro",
  "version": "1.0"
}
EOF
fi

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
echo "✅ 完整模型下载完成！"
echo ""
echo "💡 下一步："
echo "   重新启动服务："
echo "   ./scripts/remote-restart.sh"
