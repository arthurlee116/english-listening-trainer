#!/bin/bash
# SSH 到远程服务器

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🔗 连接到远程服务器..."
echo ""

ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST}
