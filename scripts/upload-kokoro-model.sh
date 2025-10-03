#!/bin/bash
# 上传 Kokoro 模型到远程服务器

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
LOCAL_MODEL_DIR="./kokoro-models/Kokoro-82M"
REMOTE_CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"

echo "📤 上传 Kokoro 模型到远程服务器..."
echo ""

# 检查本地模型是否存在
if [ ! -d "$LOCAL_MODEL_DIR" ]; then
    echo "❌ 本地模型目录不存在: $LOCAL_MODEL_DIR"
    echo ""
    echo "💡 请先运行: ./scripts/download-kokoro-model.sh"
    exit 1
fi

# 显示本地模型信息
echo "📊 本地模型信息："
du -sh "$LOCAL_MODEL_DIR"
echo ""

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

# 检查远程是否已有模型
echo "🔍 检查远程服务器..."
REMOTE_EXISTS=$(ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "[ -d ${REMOTE_CACHE_DIR} ] && echo 'yes' || echo 'no'")

if [ "$REMOTE_EXISTS" = "yes" ]; then
    echo "⚠️  远程已存在模型目录"
    echo ""
    read -p "是否删除并重新上传？[y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  删除远程旧模型..."
        ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "rm -rf ${REMOTE_CACHE_DIR}"
    else
        echo "📝 将覆盖同名文件，保留其他文件"
    fi
fi

# 在远程创建目录结构
echo "📁 创建远程目录..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p ${REMOTE_CACHE_DIR}/snapshots/main"

# 上传模型文件
echo ""
echo "📤 上传模型文件（这可能需要几分钟）..."
echo ""

# 优化的 SSH 参数（减少加密开销，提高速度）
SSH_OPTS="-p ${REMOTE_PORT} -o Compression=no -o Ciphers=aes128-gcm@openssh.com"

# 使用 rsync 上传（如果可用），否则使用 scp
if command -v rsync >/dev/null 2>&1; then
    echo "使用 rsync 上传（优化模式）..."
    echo "💡 提示：.pth 文件已压缩，禁用传输压缩以提高速度"
    
    # --no-compress: 不压缩（.pth 已经是压缩格式）
    # --partial: 支持断点续传
    # --inplace: 直接写入，不创建临时文件
    rsync -av --no-compress --partial --inplace --progress \
        -e "ssh ${SSH_OPTS}" \
        "$LOCAL_MODEL_DIR/" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_CACHE_DIR}/snapshots/main/"
else
    echo "使用 scp 上传（优化模式）..."
    
    # -C: 禁用压缩
    # -l: 限速（如果需要）
    scp ${SSH_OPTS} -C -r \
        "$LOCAL_MODEL_DIR/"* \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_CACHE_DIR}/snapshots/main/"
fi

# 创建 refs 文件
echo ""
echo "📝 创建 HuggingFace 缓存元数据..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
CACHE_DIR="~/english-listening-trainer/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"

# 创建 refs 目录和文件
mkdir -p "$CACHE_DIR/refs"
echo "main" > "$CACHE_DIR/refs/main"

# 验证文件
echo ""
echo "📊 远程模型信息："
du -sh "$CACHE_DIR"
echo ""
echo "📄 模型文件："
ls -lh "$CACHE_DIR/snapshots/main/" | head -20
ENDSSH

echo ""
echo "✅ 模型上传完成！"
echo ""
echo "💡 下一步："
echo "   重新启动服务："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml restart app'"
