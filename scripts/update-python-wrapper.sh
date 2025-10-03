#!/bin/bash
# 更新 Python wrapper 到服务器

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "📤 上传更新的 Python wrapper..."

scp -P ${REMOTE_PORT} \
    kokoro-local/kokoro_wrapper_real.py \
    ${REMOTE_USER}@${REMOTE_HOST}:~/english-listening-trainer/kokoro-local/

echo "✅ 上传完成"
echo ""
echo "🔄 重启服务..."

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} \
    'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml restart app'

echo ""
echo "✅ 服务已重启"
echo ""
echo "📊 查看日志："
echo "   ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs -f app'"
