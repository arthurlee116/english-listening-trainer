#!/bin/bash
# 紧急磁盘空间清理 - 直接在远程执行，不需要上传文件

set -e

REMOTE_HOST="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"

echo "🚨 紧急磁盘空间清理..."
echo "目标: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo ""

# 直接在远程执行清理命令
ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} bash << 'ENDSSH'
set -e

echo "📊 清理前磁盘状态："
df -h / | head -2

echo ""
echo "🗑️  开始紧急清理..."

# 1. 停止所有 Docker 容器
echo "⏸️  停止所有容器..."
docker stop $(docker ps -aq) 2>/dev/null || true

# 2. 删除所有停止的容器
echo "🗑️  删除停止的容器..."
docker container prune -f 2>/dev/null || true

# 3. 删除所有未使用的镜像（包括悬空镜像）
echo "🗑️  删除未使用的镜像..."
docker image prune -a -f 2>/dev/null || true

# 4. 删除所有未使用的卷
echo "🗑️  删除未使用的卷..."
docker volume prune -f 2>/dev/null || true

# 5. 清理构建缓存
echo "🗑️  清理构建缓存..."
docker builder prune -a -f 2>/dev/null || true

# 6. 清理系统缓存
echo "🗑️  清理 apt 缓存..."
sudo apt-get clean 2>/dev/null || true

# 7. 清理日志
echo "🗑️  清理系统日志..."
sudo journalctl --vacuum-time=1d 2>/dev/null || true

# 8. 清理项目文件
if [ -d ~/english-listening-trainer ]; then
    echo "🗑️  清理项目临时文件..."
    
    # 清理音频文件（保留最近1天）
    find ~/english-listening-trainer/public/audio -name "*.wav" -mtime +1 -delete 2>/dev/null || true
    
    # 清理日志文件（保留最近3天）
    find ~/english-listening-trainer/logs -name "*.log" -mtime +3 -delete 2>/dev/null || true
    
    # 清理备份文件（保留最近7天）
    find ~/english-listening-trainer/backups -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    
    # 清理 node_modules 缓存
    rm -rf ~/english-listening-trainer/node_modules/.cache 2>/dev/null || true
    
    # 清理 Next.js 缓存
    rm -rf ~/english-listening-trainer/.next/cache 2>/dev/null || true
fi

# 9. 清理用户缓存
echo "🗑️  清理用户缓存..."
rm -rf ~/.cache/pip 2>/dev/null || true
rm -rf ~/.npm 2>/dev/null || true
rm -rf /tmp/* 2>/dev/null || true

# 10. 显示最大的目录
echo ""
echo "📊 最大的目录（前10）："
du -sh /* 2>/dev/null | sort -h | tail -10 || true

echo ""
echo "📊 清理后磁盘状态："
df -h / | head -2

echo ""
echo "📦 Docker 磁盘使用："
docker system df 2>/dev/null || true

echo ""
echo "✅ 紧急清理完成！"

# 检查可用空间
AVAILABLE=$(df / | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE / 1024 / 1024))

echo ""
if [ $AVAILABLE_GB -lt 5 ]; then
    echo "⚠️  警告：可用空间仍然不足 ${AVAILABLE_GB}GB"
    echo ""
    echo "💡 建议："
    echo "   1. 检查大文件：du -sh /var/* 2>/dev/null | sort -h | tail -10"
    echo "   2. 检查 Docker 数据：du -sh /var/lib/docker/* 2>/dev/null | sort -h | tail -10"
    echo "   3. 考虑扩容磁盘或删除不必要的数据"
else
    echo "✅ 可用空间：${AVAILABLE_GB}GB（足够构建）"
fi
ENDSSH

echo ""
echo "✅ 远程清理完成！"
echo ""
echo "💡 下一步："
echo "   如果空间足够，可以重新部署："
echo "   ./scripts/remote-optimize-gpu.sh"
