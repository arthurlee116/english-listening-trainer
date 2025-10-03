#!/bin/bash
# 查看远程服务器日志

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "📋 查看服务日志..."
echo "按 Ctrl+C 退出"
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} \
    'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs -f app'
