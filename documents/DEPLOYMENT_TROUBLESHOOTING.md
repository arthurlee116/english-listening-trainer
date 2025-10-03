# 部署故障排查指南

## 🔍 快速诊断

### 步骤 1：测试服务器连接

```bash
# 运行环境测试脚本
./scripts/test-remote-connection.sh

# 或指定服务器信息
./scripts/test-remote-connection.sh 49.234.30.246 60022 ubuntu
```

这个脚本会检查：
- ✅ SSH 连接
- ✅ 操作系统类型
- ✅ sudo 权限
- ✅ Git, Docker, Python
- ✅ GPU 和驱动
- ✅ 磁盘和内存

### 步骤 2：启用调试模式

```bash
# 使用调试模式运行部署脚本
./scripts/remote-deploy-gpu.sh --debug
```

---

## 🐛 常见问题和解决方案

### 问题 1：操作系统检测失败

**错误信息**：
```
[ERROR] 不支持的操作系统，无法自动安装 Docker
```

**原因**：
- 服务器的 `/etc/os-release` 文件不存在或格式异常
- SSH 连接问题导致无法读取系统信息

**解决方案**：

1. **手动检查操作系统**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 'cat /etc/os-release'
```

2. **如果是 Ubuntu，手动安装 Docker**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 'curl -fsSL https://get.docker.com | sudo sh'
```

3. **然后重新运行部署脚本**：
```bash
./scripts/remote-deploy-gpu.sh
```

---

### 问题 2：SSH 连接失败

**错误信息**：
```
[ERROR] 无法连接到远程服务器
```

**解决方案**：

1. **测试基本连接**：
```bash
ssh -p 60022 ubuntu@49.234.30.246
```

2. **检查 SSH 密钥**：
```bash
# 查看已加载的密钥
ssh-add -l

# 添加密钥
ssh-add ~/.ssh/id_rsa
```

3. **使用密码认证**（临时）：
```bash
ssh -p 60022 ubuntu@49.234.30.246 -o PreferredAuthentications=password
```

4. **配置 SSH 密钥**：
```bash
# 生成密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 复制到服务器
ssh-copy-id -p 60022 ubuntu@49.234.30.246
```

---

### 问题 3：Docker 安装失败

**错误信息**：
```
[ERROR] Docker 安装失败
```

**解决方案**：

1. **使用官方安装脚本**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 << 'EOF'
  # 下载并运行 Docker 安装脚本
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  
  # 添加用户到 docker 组
  sudo usermod -aG docker $USER
  
  # 启动 Docker
  sudo systemctl start docker
  sudo systemctl enable docker
  
  # 验证安装
  docker --version
EOF
```

2. **重新登录使 docker 组生效**：
```bash
# 退出并重新登录
exit
ssh -p 60022 ubuntu@49.234.30.246
```

3. **测试 Docker**：
```bash
docker run hello-world
```

---

### 问题 4：GPU 不可用

**错误信息**：
```
[WARN] 未检测到 NVIDIA GPU 或驱动
```

**解决方案**：

1. **检查 GPU 硬件**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 'lspci | grep -i nvidia'
```

2. **安装 NVIDIA 驱动**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 << 'EOF'
  # 添加驱动 PPA
  sudo add-apt-repository -y ppa:graphics-drivers/ppa
  sudo apt-get update
  
  # 自动安装推荐驱动
  sudo ubuntu-drivers autoinstall
  
  # 或安装特定版本（推荐 535+）
  sudo apt-get install -y nvidia-driver-535
EOF
```

3. **重启服务器**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 'sudo reboot'
```

4. **验证驱动**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 'nvidia-smi'
```

---

### 问题 5：NVIDIA Container Toolkit 安装失败

**错误信息**：
```
[ERROR] NVIDIA Container Toolkit 安装失败
```

**解决方案**：

```bash
ssh -p 60022 ubuntu@49.234.30.246 << 'EOF'
  # 添加仓库
  distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
    sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  
  curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
  
  # 安装
  sudo apt-get update
  sudo apt-get install -y nvidia-container-toolkit
  
  # 配置 Docker
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker
  
  # 测试
  docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
EOF
```

---

### 问题 6：项目目录不存在

**错误信息**：
```
[ERROR] 项目目录不存在且未提供 Git 仓库地址
```

**解决方案**：

1. **指定仓库地址**：
```bash
./scripts/remote-deploy-gpu.sh \
  --repo https://github.com/your-username/english-listening-trainer.git
```

2. **或手动克隆**：
```bash
ssh -p 60022 ubuntu@49.234.30.246 << 'EOF'
  git clone https://github.com/your-username/english-listening-trainer.git ~/english-listening-trainer
  cd ~/english-listening-trainer
  git checkout main
EOF
```

---

### 问题 7：权限不足

**错误信息**：
```
Permission denied
sudo: a password is required
```

**解决方案**：

1. **配置无密码 sudo**：
```bash
ssh -p 60022 ubuntu@49.234.30.246
sudo visudo

# 添加以下行（将 ubuntu 替换为你的用户名）
ubuntu ALL=(ALL) NOPASSWD: ALL
```

2. **或在部署时输入密码**：
脚本会在需要时提示输入 sudo 密码

---

### 问题 8：端口被占用

**错误信息**：
```
Error: Port 3000 is already in use
```

**解决方案**：

```bash
ssh -p 60022 ubuntu@49.234.30.246 << 'EOF'
  # 查看占用端口的进程
  sudo lsof -i :3000
  
  # 停止进程
  sudo kill -9 <PID>
  
  # 或停止所有 Docker 容器
  docker stop $(docker ps -q)
EOF
```

---

## 🔧 手动部署步骤

如果自动部署脚本失败，可以手动执行以下步骤：

### 1. 连接到服务器

```bash
ssh -p 60022 ubuntu@49.234.30.246
```

### 2. 安装依赖

```bash
# 更新系统
sudo apt-get update

# 安装基础工具
sudo apt-get install -y git curl wget build-essential

# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 安装 Python 和依赖
sudo apt-get install -y python3 python3-pip python3-venv python3-dev espeak-ng

# 安装 NVIDIA 驱动（如果有 GPU）
sudo ubuntu-drivers autoinstall

# 安装 NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 3. 克隆项目

```bash
cd ~
git clone https://github.com/your-username/english-listening-trainer.git
cd english-listening-trainer
git checkout main
```

### 4. 配置环境变量

```bash
cp .env.production.example .env.production
nano .env.production

# 配置必需的环境变量：
# CEREBRAS_API_KEY=你的API密钥
# JWT_SECRET=$(openssl rand -hex 32)
# KOKORO_DEVICE=cuda
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=强密码
```

### 5. 部署应用

```bash
# 创建必需目录
mkdir -p data public/audio logs backups

# 设置 TTS 环境
./scripts/setup-kokoro-complete.sh

# 使用 Docker 部署
docker compose -f docker-compose.gpu.yml build app
docker compose -f docker-compose.gpu.yml run --rm migrate
docker compose -f docker-compose.gpu.yml up -d app

# 查看日志
docker compose -f docker-compose.gpu.yml logs -f app
```

### 6. 验证部署

```bash
# 健康检查
curl http://localhost:3000/api/health

# GPU 检查
nvidia-smi

# 容器状态
docker compose -f docker-compose.gpu.yml ps
```

---

## 📞 获取帮助

### 查看日志

```bash
# 部署脚本日志
./scripts/remote-deploy-gpu.sh --debug 2>&1 | tee deploy.log

# 服务器应用日志
ssh -p 60022 ubuntu@49.234.30.246 \
  'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs --tail=100'
```

### 收集诊断信息

```bash
# 运行诊断脚本
./scripts/test-remote-connection.sh > diagnostic.txt 2>&1

# 查看诊断结果
cat diagnostic.txt
```

### 联系支持

提供以下信息：
1. 错误信息截图
2. 诊断脚本输出（diagnostic.txt）
3. 服务器操作系统版本
4. GPU 型号和驱动版本

---

## 📚 相关文档

- [远程部署脚本指南](./REMOTE_DEPLOY_SCRIPT_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [快速参考](./DEPLOY_QUICK_REFERENCE.md)

---

**最后更新**：2025-02-10  
**版本**：1.0
