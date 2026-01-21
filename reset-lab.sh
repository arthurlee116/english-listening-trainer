#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}正在诊断实验环境...${NC}"

# 1. 尝试清理端口 3000 (Next.js)
PID_3000=$(lsof -t -i:3000)
if [ -n "$PID_3000" ]; then
    echo -e "${RED}发现 3000 端口被占用 (PID: $PID_3000)，正在清理...${NC}"
    kill -9 $PID_3000
else
    echo "端口 3000 干净。"
fi

# 2. 尝试清理端口 4000 (TCP Server)
PID_4000=$(lsof -t -i:4000)
if [ -n "$PID_4000" ]; then
    echo -e "${RED}发现 4000 端口被占用 (PID: $PID_4000)，正在清理...${NC}"
    kill -9 $PID_4000
else
    echo "端口 4000 干净。"
fi

echo -e "${GREEN}环境清理完毕！${NC}"
echo "----------------------------------------"
echo "请按照以下步骤重启实验（需要两个终端窗口）："
echo "1. 在当前窗口运行网站服务器:"
echo -e "   ${GREEN}npm run dev${NC}"
echo ""
echo "2. 点击终端右上角 '+' 号新建一个窗口，运行 TCP 引擎:"
echo -e "   ${GREEN}node tcp-labs/server.js${NC}"
echo "----------------------------------------"
