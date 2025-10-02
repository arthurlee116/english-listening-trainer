#!/bin/bash
# GPU 环境配置脚本
# 在 Docker 安装完成后运行

set -e

echo "=========================================="
echo "配置 GPU 环境"
echo "=========================================="

# 1. 检查 NVIDIA 驱动
echo "步骤 1: 检查 NVIDIA 驱动..."
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "✓ NVIDIA 驱动已安装"
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
else
  echo "✗ NVIDIA 驱动未安装"
  echo "是否安装 NVIDIA 驱动？[y/N]"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "安装 NVIDIA 驱动..."
    sudo add-apt-repository -y ppa:graphics-drivers/ppa
    sudo apt-get update
    sudo ubuntu-drivers autoinstall
    echo "驱动安装完成，需要重启服务器"
    echo "运行: sudo reboot"
    exit 0
  fi
fi

# 2. 安装 NVIDIA Container Toolkit
echo "步骤 2: 安装 NVIDIA Container Toolkit..."
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)

# 添加仓库
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# 安装
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 3. 配置 Docker
echo "步骤 3: 配置 Docker GPU 支持..."
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# 4. 测试 GPU 支持
echo "步骤 4: 测试 GPU 支持..."
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi

echo "=========================================="
echo "GPU 环境配置完成！"
echo "=========================================="
