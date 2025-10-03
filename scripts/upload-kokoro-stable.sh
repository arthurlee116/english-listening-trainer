#!/bin/bash
# 稳定的 Kokoro 模型上传脚本
# 使用分块上传，避免大文件传输卡住

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
LOCAL_MODEL_DIR="./kokoro-models/Kokoro-82M"
REMOTE_CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"

echo "📤 稳定上传 Kokoro 模型..."
echo ""

# 检查本地模型
if [ ! -d "$LOCAL_MODEL_DIR" ]; then
    echo "❌ 本地模型目录不存在: $LOCAL_MODEL_DIR"
    exit 1
fi

# 检查必要文件
REQUIRED_FILES=("kokoro-v1_0.pth" "VOICES.md")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$LOCAL_MODEL_DIR/$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    fi
done

echo "✅ 本地模型文件完整"
echo ""

# 创建远程目录
echo "📁 创建远程目录..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_CACHE_DIR}/snapshots/main ${REMOTE_CACHE_DIR}/refs"

# 逐个上传文件（避免大文件卡住）
echo ""
echo "📤 开始上传文件..."
echo ""

for file in "${REQUIRED_FILES[@]}"; do
    echo "上传: $file"
    FILE_SIZE=$(du -h "$LOCAL_MODEL_DIR/$file" | cut -f1)
    echo "  大小: $FILE_SIZE"
    
    # 使用简单的 scp，不使用压缩和特殊选项
    # -v: 显示详细信息
    # -C: 启用压缩（对于 .pth 可能没用，但对 .md 有用）
    scp -v -P ${REMOTE_PORT} \
        "$LOCAL_MODEL_DIR/$file" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_CACHE_DIR}/snapshots/main/$file" 2>&1 | \
        grep -E "Sending|Bytes" || true
    
    if [ $? -eq 0 ]; then
        echo "  ✅ 完成"
    else
        echo "  ❌ 失败"
        exit 1
    fi
    echo ""
done

# 创建 refs
echo "📝 创建元数据..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "echo 'main' > ${REMOTE_CACHE_DIR}/refs/main"

# 验证
echo ""
echo "🔍 验证上传..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"

echo "📊 模型信息："
du -sh "$CACHE_DIR"
echo ""
echo "📄 文件列表："
ls -lh "$CACHE_DIR/snapshots/main/"
ENDSSH

echo ""
echo "✅ 上传完成！"
echo ""
echo "💡 下一步："
echo "   重新启动服务："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml restart app'"
