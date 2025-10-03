#!/bin/bash
# 检查并链接现有的 Kokoro 模型
# 避免重复下载

set -e

echo "🔍 检查现有 Kokoro 模型..."

# 可能的模型位置
POSSIBLE_LOCATIONS=(
    "$HOME/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
    "/root/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
    "./kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
    "./kokoro-main-ref/models/Kokoro-82M"
    "/app/kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M"
)

TARGET_DIR="./kokoro-local/.cache/huggingface/hub"
MODEL_NAME="models--hexgrad--Kokoro-82M"

# 创建目标目录
mkdir -p "$TARGET_DIR"

# 检查是否已经存在
if [ -d "$TARGET_DIR/$MODEL_NAME" ]; then
    MODEL_SIZE=$(du -sh "$TARGET_DIR/$MODEL_NAME" | cut -f1)
    echo "✅ 模型已存在: $TARGET_DIR/$MODEL_NAME"
    echo "📊 模型大小: $MODEL_SIZE"
    
    # 检查是否有必要的文件
    if [ -f "$TARGET_DIR/$MODEL_NAME/snapshots/"*/config.json ]; then
        echo "✅ 模型文件完整"
        exit 0
    else
        echo "⚠️  模型文件不完整，将重新下载"
    fi
fi

# 搜索现有模型
echo ""
echo "🔍 搜索现有模型位置..."
FOUND_MODEL=""

for location in "${POSSIBLE_LOCATIONS[@]}"; do
    if [ -d "$location" ]; then
        # 检查是否有必要的文件
        if find "$location" -name "config.json" -type f | grep -q .; then
            MODEL_SIZE=$(du -sh "$location" | cut -f1)
            echo "✅ 找到模型: $location ($MODEL_SIZE)"
            FOUND_MODEL="$location"
            break
        fi
    fi
done

if [ -n "$FOUND_MODEL" ]; then
    echo ""
    echo "🔗 创建符号链接到现有模型..."
    
    # 如果目标已存在，先删除
    rm -rf "$TARGET_DIR/$MODEL_NAME"
    
    # 创建符号链接
    ln -s "$(realpath "$FOUND_MODEL")" "$TARGET_DIR/$MODEL_NAME"
    
    echo "✅ 符号链接创建成功"
    echo "   源: $FOUND_MODEL"
    echo "   目标: $TARGET_DIR/$MODEL_NAME"
    
    # 验证链接
    if [ -L "$TARGET_DIR/$MODEL_NAME" ] && [ -e "$TARGET_DIR/$MODEL_NAME" ]; then
        echo "✅ 链接验证成功"
    else
        echo "❌ 链接验证失败"
        exit 1
    fi
else
    echo ""
    echo "⚠️  未找到现有模型"
    echo "💡 首次运行时，模型将自动下载（约 300MB，需要 3-5 分钟）"
    echo ""
    echo "📝 模型将下载到: $TARGET_DIR/$MODEL_NAME"
fi

echo ""
echo "✅ 模型检查完成"
