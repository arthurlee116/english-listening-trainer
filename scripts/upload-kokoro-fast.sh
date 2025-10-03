#!/bin/bash
# 快速上传 Kokoro 模型（使用压缩包）
# 适合慢速网络

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
LOCAL_MODEL_DIR="./kokoro-models/Kokoro-82M"
REMOTE_CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
TEMP_ARCHIVE="/tmp/kokoro-model.tar.gz"

echo "🚀 快速上传 Kokoro 模型（压缩包方式）..."
echo ""

# 检查本地模型是否存在
if [ ! -d "$LOCAL_MODEL_DIR" ]; then
    echo "❌ 本地模型目录不存在: $LOCAL_MODEL_DIR"
    echo ""
    echo "💡 请先运行: python3 scripts/download-kokoro-simple.py"
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

# 创建压缩包
echo "📦 创建压缩包..."
tar -czf "$TEMP_ARCHIVE" -C "$(dirname "$LOCAL_MODEL_DIR")" "$(basename "$LOCAL_MODEL_DIR")"

ARCHIVE_SIZE=$(du -sh "$TEMP_ARCHIVE" | cut -f1)
echo "✅ 压缩包创建完成: $ARCHIVE_SIZE"
echo ""

# 上传压缩包
echo "📤 上传压缩包（这比直接上传文件快得多）..."
echo ""

# 使用 scp 上传（注意：scp 的端口参数是 -P 大写）
scp -P ${REMOTE_PORT} -o Compression=no -o Ciphers=aes128-gcm@openssh.com \
    "$TEMP_ARCHIVE" \
    "${REMOTE_USER}@${REMOTE_HOST}:/tmp/kokoro-model.tar.gz"

echo ""
echo "✅ 上传完成"
echo ""

# 在远程解压
echo "📦 在远程服务器解压..."
ssh -p ${REMOTE_PORT} -o Compression=no ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
set -e

CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
TEMP_ARCHIVE="/tmp/kokoro-model.tar.gz"

# 删除旧模型（如果存在）
if [ -d "$CACHE_DIR" ]; then
    echo "🗑️  删除旧模型..."
    rm -rf "$CACHE_DIR"
fi

# 创建目录
mkdir -p "$CACHE_DIR/snapshots"

# 解压到 snapshots/main
echo "📦 解压模型文件..."
tar -xzf "$TEMP_ARCHIVE" -C "$CACHE_DIR/snapshots/"
mv "$CACHE_DIR/snapshots/Kokoro-82M" "$CACHE_DIR/snapshots/main"

# 创建 refs
mkdir -p "$CACHE_DIR/refs"
echo "main" > "$CACHE_DIR/refs/main"

# 清理临时文件
rm -f "$TEMP_ARCHIVE"

# 验证
echo ""
echo "📊 远程模型信息："
du -sh "$CACHE_DIR"
echo ""
echo "📄 模型文件："
ls -lh "$CACHE_DIR/snapshots/main/"

echo ""
echo "✅ 解压完成"
ENDSSH

# 清理本地临时文件
rm -f "$TEMP_ARCHIVE"

echo ""
echo "✅ 模型上传完成！"
echo ""
echo "💡 下一步："
echo "   重新启动服务："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml restart app'"
