#!/bin/bash
# 手动安装 Docker 的命令
# 在服务器上直接运行这些命令

set -e

echo "=========================================="
echo "手动安装 Docker"
echo "=========================================="

# 1. 清理旧版本和损坏的配置
echo "步骤 1: 清理旧版本..."
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# 2. 更新系统并安装依赖
echo "步骤 2: 安装依赖..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 3. 添加 Docker GPG 密钥（使用阿里云镜像）
echo "步骤 3: 添加 Docker GPG 密钥..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. 添加 Docker 仓库（使用阿里云镜像）
echo "步骤 4: 添加 Docker 仓库..."
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. 安装 Docker
echo "步骤 5: 安装 Docker..."
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. 启动 Docker
echo "步骤 6: 启动 Docker 服务..."
sudo systemctl start docker
sudo systemctl enable docker

# 7. 添加当前用户到 docker 组
echo "步骤 7: 配置用户权限..."
sudo usermod -aG docker $USER

# 8. 验证安装
echo "步骤 8: 验证安装..."
docker --version
sudo docker run hello-world

echo "=========================================="
echo "Docker 安装完成！"
echo "=========================================="
echo "注意：需要重新登录才能使用 docker 命令（不需要 sudo）"
echo "运行: exit 然后重新 ssh 登录"
