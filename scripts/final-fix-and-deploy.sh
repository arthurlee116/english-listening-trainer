#!/bin/bash
# 最终修复和部署脚本
# 使用完全离线的 Kokoro wrapper

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🎯 最终修复和部署..."
echo ""

# 1. 清理服务器
echo "步骤 1/6: 清理服务器..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "🗑️  删除所有旧的 wrapper 文件..."
find kokoro-local -name "kokoro_wrapper*.py" -type f -delete 2>/dev/null || true
find kokoro-local -name "*.pyc" -type f -delete 2>/dev/null || true
find kokoro-local -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✅ 清理完成"
ENDSSH

# 2. 上传新文件
echo ""
echo "步骤 2/6: 上传新文件..."
scp -P ${REMOTE_PORT} kokoro-local/kokoro_wrapper_offline.py ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/kokoro-local/
scp -P ${REMOTE_PORT} lib/kokoro-env.ts ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/lib/
scp -P ${REMOTE_PORT} .env.production ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/

echo "✅ 文件上传完成"

# 3. 验证文件
echo ""
echo "步骤 3/6: 验证文件..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "📄 Wrapper 文件："
ls -lh kokoro-local/kokoro_wrapper*.py

echo ""
echo "📄 模型文件："
ls -lh kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main/ 2>/dev/null || echo "模型文件未找到"
ENDSSH

# 4. 停止服务
echo ""
echo "步骤 4/6: 停止服务..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer
docker compose -f docker-compose.gpu.yml down
ENDSSH

# 5. 重新构建
echo ""
echo "步骤 5/6: 重新构建镜像（这需要几分钟）..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "🔨 重新构建..."
docker compose -f docker-compose.gpu.yml build --no-cache app

echo ""
echo "🚀 启动服务..."
docker compose -f docker-compose.gpu.yml up -d app
ENDSSH

# 6. 监控启动
echo ""
echo "步骤 6/6: 监控服务启动..."
echo "⏳ 等待 30 秒..."
sleep 30

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
cd ~/english-listening-trainer

echo "📊 服务状态："
docker compose -f docker-compose.gpu.yml ps app

echo ""
echo "📋 启动日志（最后 50 行）："
docker compose -f docker-compose.gpu.yml logs --tail=50 app | grep -E "Kokoro|Model|GPU|ready|Error|Failed" || docker compose -f docker-compose.gpu.yml logs --tail=50 app
ENDSSH

echo ""
echo "✅ 部署完成！"
echo ""
echo "🔍 关键检查点："
echo "   1. 查找 '✅ Found local model' - 模型文件被找到"
echo "   2. 查找 '📥 Loading model weights directly' - 直接加载权重"
echo "   3. 查找 '🚀 Kokoro TTS service is ready (offline mode)' - 服务就绪"
echo ""
echo "💡 查看完整日志："
echo "   ./scripts/remote-logs.sh"
