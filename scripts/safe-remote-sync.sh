#!/bin/bash

# 安全同步脚本 - 保护远程服务器上的关键配置
# 不会覆盖远程的 GPU/TTS 相关更改

set -e

SERVER="ubuntu@49.234.30.246"
PORT="60022"
PROJECT_DIR="~/english-listening-trainer"

echo "🔍 检查远程服务器状态..."

# 1. 检查远程是否有未提交的更改
echo "📋 检查远程未提交的更改..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && git status --short" || {
    echo "❌ 无法连接到远程服务器"
    exit 1
}

# 2. 显示远程当前分支
echo ""
echo "📍 远程当前分支:"
ssh -p $PORT $SERVER "cd $PROJECT_DIR && git branch --show-current"

# 3. 询问用户是否继续
echo ""
echo "⚠️  注意: 远程服务器可能有未同步的 GPU/TTS 配置"
echo "建议操作:"
echo "  1. 先备份远程的关键文件"
echo "  2. 使用 git stash 保存远程更改"
echo "  3. 拉取最新代码"
echo "  4. 恢复 stash 的更改"
echo ""
read -p "是否继续? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

# 4. 在远程服务器上执行安全同步
echo ""
echo "🔄 开始安全同步..."
ssh -p $PORT $SERVER "cd $PROJECT_DIR && bash -s" << 'ENDSSH'
set -e

echo "📦 保存远程更改到 stash..."
git stash push -m "Auto-stash before sync $(date +%Y%m%d_%H%M%S)"

echo "📥 拉取最新代码..."
git fetch origin
git pull origin feature/exercise-template

echo "📤 恢复之前的更改..."
if git stash list | grep -q "Auto-stash before sync"; then
    git stash pop || {
        echo "⚠️  有冲突需要手动解决"
        echo "运行以下命令查看冲突:"
        echo "  git status"
        echo "  git diff"
        exit 1
    }
fi

echo "✅ 同步完成"
ENDSSH

echo ""
echo "✅ 远程服务器代码已安全同步"
echo ""
echo "📋 下一步:"
echo "  1. 检查音频播放问题: ./scripts/remote-logs.sh"
echo "  2. 查看服务状态: ./scripts/remote-status.sh"
echo "  3. 如需重启: ./scripts/remote-restart.sh"
