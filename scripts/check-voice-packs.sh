#!/bin/bash
# 检查 Kokoro 语音包

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🔍 检查 Kokoro 语音包..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
echo "📁 检查可能的语音包位置..."

# 检查 HuggingFace 缓存
if [ -d ~/.cache/huggingface ]; then
    echo ""
    echo "~/.cache/huggingface 内容："
    find ~/.cache/huggingface -name "*voice*" -o -name "*af_bella*" -o -name "*.pth" 2>/dev/null | head -20
fi

# 检查项目目录
if [ -d ~/english-listening-trainer/kokoro-local ]; then
    echo ""
    echo "kokoro-local 内容："
    ls -la ~/english-listening-trainer/kokoro-local/
    
    if [ -d ~/english-listening-trainer/kokoro-local/voices ]; then
        echo ""
        echo "voices 目录："
        ls -la ~/english-listening-trainer/kokoro-local/voices/
    fi
fi

# 检查 kokoro-main-ref
if [ -d ~/english-listening-trainer/kokoro-main-ref ]; then
    echo ""
    echo "kokoro-main-ref 内容："
    find ~/english-listening-trainer/kokoro-main-ref -name "*voice*" -o -name "*.pth" 2>/dev/null | head -20
fi

# 检查模型目录
MODEL_DIR=~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M
if [ -d "$MODEL_DIR" ]; then
    echo ""
    echo "模型目录完整内容："
    find "$MODEL_DIR" -type f 2>/dev/null
fi
ENDSSH

echo ""
echo "✅ 检查完成"
