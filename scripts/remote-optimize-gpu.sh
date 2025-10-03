#!/bin/bash
# 远程 GPU 优化部署脚本

set -e

# 配置
REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
REMOTE_DIR="~/english-listening-trainer"

echo "🚀 开始远程 GPU 优化部署..."

# 1. 上传优化后的文件
echo ""
echo "📤 上传优化文件..."
scp -P ${REMOTE_PORT} .env.production ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env.production
scp -P ${REMOTE_PORT} lib/kokoro-service-gpu.ts ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/lib/kokoro-service-gpu.ts
scp -P ${REMOTE_PORT} kokoro-local/kokoro_wrapper_real.py ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/kokoro-local/kokoro_wrapper_real.py
scp -P ${REMOTE_PORT} docker-compose.gpu.yml ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.gpu.yml
scp -P ${REMOTE_PORT} scripts/optimize-gpu-tts.sh ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/optimize-gpu-tts.sh
scp -P ${REMOTE_PORT} scripts/prepare-hf-cache.sh ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/prepare-hf-cache.sh
scp -P ${REMOTE_PORT} scripts/check-and-link-models.sh ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/check-and-link-models.sh

# 2. 在远程服务器上执行优化
echo ""
echo "🔧 在远程服务器上执行优化..."
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} << 'ENDSSH'
cd ~/english-listening-trainer

# 赋予执行权限
chmod +x scripts/optimize-gpu-tts.sh
chmod +x scripts/prepare-hf-cache.sh
chmod +x scripts/check-and-link-models.sh

# 检查并链接现有模型
echo "🔍 检查现有模型..."
./scripts/check-and-link-models.sh

# 准备 HuggingFace 缓存
echo "📦 准备 HuggingFace 缓存..."
./scripts/prepare-hf-cache.sh || true

# 拉取基础镜像
echo "📥 拉取基础 Docker 镜像..."
docker pull ubuntu:22.04

# 执行优化脚本
./scripts/optimize-gpu-tts.sh
ENDSSH

echo ""
echo "✅ 远程 GPU 优化完成！"
echo ""
echo "🎯 优化内容："
echo "   ✓ 初始化超时：3分钟 → 10分钟"
echo "   ✓ TTS 超时：2分钟 → 5分钟"
echo "   ✓ 并发数：4 → 8"
echo "   ✓ GPU 显存块：512MB → 1024MB"
echo "   ✓ 添加 GPU 预热机制"
echo "   ✓ 优化初始化日志"
echo ""
echo "📊 测试建议："
echo "   1. 等待 5-10 分钟让模型完全加载"
echo "   2. 首次 TTS 请求会触发预热"
echo "   3. 后续请求应该很快（2-5秒）"
echo ""
echo "🔍 监控命令："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.gpu.yml logs -f app'"
