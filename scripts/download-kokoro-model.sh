#!/bin/bash
# 从 HuggingFace 下载 Kokoro 模型到本地

set -e

MODEL_DIR="./kokoro-models/Kokoro-82M"
REPO_ID="hexgrad/Kokoro-82M"

echo "📥 下载 Kokoro-82M 模型..."
echo ""

# 创建目录
mkdir -p "$MODEL_DIR"

echo "💡 下载方式："
echo "   1. 使用 huggingface-cli（推荐）"
echo "   2. 使用 git clone"
echo "   3. 手动下载"
echo ""

# 检查是否安装了 huggingface-cli
if command -v huggingface-cli >/dev/null 2>&1; then
    echo "✅ 检测到 huggingface-cli"
    echo ""
    echo "🚀 开始下载..."
    
    huggingface-cli download "$REPO_ID" \
        --local-dir "$MODEL_DIR" \
        --local-dir-use-symlinks False
    
    echo ""
    echo "✅ 下载完成！"
else
    echo "⚠️  未安装 huggingface-cli"
    echo ""
    echo "📝 安装方法："
    echo "   pip install huggingface-hub[cli]"
    echo ""
    echo "或者使用 git clone："
    echo "   git clone https://huggingface.co/$REPO_ID $MODEL_DIR"
    echo ""
    echo "或者手动下载以下文件到 $MODEL_DIR："
    echo "   - config.json"
    echo "   - model.safetensors (或 pytorch_model.bin)"
    echo "   - tokenizer.json"
    echo "   - vocab.json"
    echo ""
    echo "下载地址："
    echo "   https://huggingface.co/$REPO_ID/tree/main"
    exit 1
fi

# 显示下载的文件
echo ""
echo "📦 下载的文件："
ls -lh "$MODEL_DIR"

# 显示总大小
echo ""
echo "📊 总大小："
du -sh "$MODEL_DIR"

echo ""
echo "✅ 模型已下载到: $MODEL_DIR"
echo ""
echo "💡 下一步："
echo "   运行 ./scripts/upload-kokoro-model.sh 上传到服务器"
