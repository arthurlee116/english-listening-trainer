#!/bin/bash

# 启动管理界面服务器的脚本
echo "正在启动管理界面服务器..."
echo "端口: 3005"
echo "访问地址: http://localhost:3005/admin"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "======================================="

# 首先确保构建是最新的
echo "检查构建状态..."
if [ ! -d ".next" ]; then
    echo "构建 Next.js 项目..."
    npm run build
fi

# 启动管理界面服务器
NODE_ENV=development node admin-server.js