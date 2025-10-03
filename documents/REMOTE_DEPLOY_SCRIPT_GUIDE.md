# 远程部署脚本使用指南

## 📋 概述

`scripts/remote-deploy-gpu.sh` 是一个增强版的自动化部署脚本，能够：
- 自动检测服务器环境
- 自动安装缺失的依赖
- 智能处理新旧版本代码库
- 完整支持 GPU 环境配置

---

## 🚀 快速开始

### 基本用法

```bash
# 使用默认配置部署
./scripts/remote-deploy-gpu.sh

# 指定服务器和端口
./scripts/remote-deploy-gpu.sh --host 49.234.30.246 --port 60022

# 首次部署（需要指定仓库地址）
./scripts/remote-deploy-gpu.sh --repo https://github.com/your-username/your-repo.git
```

---

## 🔧 功能特性

### 1. 自动依赖检测和安装

脚本会自动检测并安装以下依赖：

#### 系统依赖
- ✅ Git
- ✅ curl, wget
- ✅ build-essential
- ✅ ca-certificates

#### Docker 环境
- ✅ Docker Engine
- ✅ Docker Compose Plugin
- ✅ Docker 用户组配置

#### GPU 支持
- ✅ NVIDIA 驱动检测
- ✅ NVIDIA Container Toolkit
- ✅ CUDA 版本兼容性检查

#### Python 环境
- ✅ Python 3.8-3.12
- ✅ pip, venv
- ✅ espeak-ng（TTS 依赖）

### 2. 智能代码库管理

#### 首次部署
- 自动克隆 Git 仓库
- 切换到指定分支
- 创建必需目录

#### 更新部署
- 检测当前分支和提交
- 自动拉取最新代码
- 保留本地配置文件

### 3. GPU 环境配置

#### 驱动检测
- 检测 NVIDIA 驱动版本
- 验证 CUDA 兼容性
- 提示升级建议

#### 自动安装选项
- NVIDIA 驱动（可选）
- NVIDIA Container Toolkit
- Docker GPU 运行时配置

---

## 📖 命令行选项

### 基本选项

```bash
--host HOST         # 远程服务器地址
--port PORT         # SSH 端口
--user USER         # SSH 用户名
--path PATH         # 远程项目路径
--branch BRANCH     # Git 分支名
```

### 高级选项

```bash
--repo URL          # Git 仓库地址（首次部署必需）
--no-backup         # 跳过部署前备份
--no-auto-install   # 不自动安装依赖
--skip-gpu-check    # 跳过 GPU 检查
--run-tests         # 部署前运行测试
```

---

## 💡 使用场景

### 场景 1：全新服务器首次部署

```bash
./scripts/remote-deploy-gpu.sh \
  --host 49.234.30.246 \
  --port 60022 \
  --user ubuntu \
  --repo https://github.com/your-username/english-listening-trainer.git \
  --branch main
```

**脚本会自动：**
1. 检测操作系统（Ubuntu/Debian/CentOS）
2. 安装系统依赖（Git, curl, build-essential）
3. 安装 Docker 和 Docker Compose
4. 检测并配置 NVIDIA GPU
5. 安装 NVIDIA Container Toolkit
6. 安装 Python 和 espeak-ng
7. 克隆项目代码
8. 配置环境变量
9. 构建和启动服务

### 场景 2：已有项目的更新部署

```bash
./scripts/remote-deploy-gpu.sh
```

**脚本会自动：**
1. 检测现有环境
2. 验证所有依赖已安装
3. 检查当前代码版本
4. 备份数据库
5. 拉取最新代码
6. 重新构建镜像
7. 运行数据库迁移
8. 重启服务

### 场景 3：无 GPU 服务器部署

```bash
./scripts/remote-deploy-gpu.sh --skip-gpu-check
```

**适用于：**
- 开发环境
- 测试服务器
- CPU-only 部署

### 场景 4：手动控制依赖安装

```bash
./scripts/remote-deploy-gpu.sh --no-auto-install
```

**适用于：**
- 需要自定义依赖版本
- 企业环境有特殊要求
- 需要手动审核安装过程

---

## 🔍 依赖检测流程

### 1. 操作系统检测

```
检测 /etc/os-release
├── Ubuntu/Debian → 使用 apt-get
├── CentOS/RHEL → 使用 yum
└── 其他 → 提示手动安装
```

### 2. Docker 检测

```
检查 docker 命令
├── 未安装 → 自动安装 Docker Engine
├── 已安装 → 检查版本
└── 检查 Docker Compose Plugin
    ├── 未安装 → 自动安装
    └── 已安装 → 验证版本
```

### 3. GPU 检测

```
检查 nvidia-smi
├── 未找到 → 提示安装驱动
│   ├── 自动安装（可选）
│   └── 手动安装指南
└── 已安装 → 检查驱动版本
    ├── >= 530 → 支持 CUDA 12.1 ✅
    ├── >= 450 → 支持 CUDA 11.8 ⚠️
    └── < 450 → 需要升级 ❌
```

### 4. NVIDIA Container Toolkit 检测

```
测试 docker run --gpus all
├── 失败 → 安装 NVIDIA Container Toolkit
│   ├── 添加仓库
│   ├── 安装包
│   └── 配置 Docker 运行时
└── 成功 → GPU 支持就绪 ✅
```

### 5. Python 环境检测

```
检查 python3
├── 未安装 → 安装 Python 3
├── 已安装 → 检查版本
│   ├── 3.8-3.12 → 符合要求 ✅
│   └── 其他版本 → 警告 ⚠️
└── 检查 espeak-ng
    ├── 未安装 → 自动安装
    └── 已安装 → 验证 ✅
```

---

## 📊 部署流程图

```
开始
  ↓
检查本地环境
  ├── Git 仓库检查
  ├── 未提交更改检查
  └── 测试连接
  ↓
测试 SSH 连接
  ↓
检测远程操作系统
  ↓
检查系统依赖
  ├── Git ✓
  ├── Docker ✗ → 安装
  ├── Python ✓
  └── espeak-ng ✗ → 安装
  ↓
检查 GPU 环境
  ├── NVIDIA 驱动 ✗ → 提示安装
  └── Container Toolkit ✗ → 安装
  ↓
检查项目目录
  ├── 不存在 → 克隆仓库
  └── 已存在 → 检查版本
  ↓
推送本地代码
  ↓
在服务器上部署
  ├── 备份数据
  ├── 拉取代码
  ├── 设置 TTS 环境
  ├── 构建镜像
  ├── 运行迁移
  └── 启动服务
  ↓
验证部署
  ├── 健康检查
  ├── GPU 检查
  └── 功能测试
  ↓
完成
```

---

## ⚙️ 环境变量

### 通过环境变量配置

```bash
# 服务器配置
export REMOTE_HOST=49.234.30.246
export REMOTE_PORT=60022
export REMOTE_USER=ubuntu
export REMOTE_PATH=~/english-listening-trainer

# Git 配置
export GIT_BRANCH=main
export GIT_REPO=https://github.com/your-username/your-repo.git

# 部署选项
export AUTO_INSTALL_DEPS=true
export BACKUP_BEFORE_DEPLOY=true
export SKIP_GPU_CHECK=false

# 运行脚本
./scripts/remote-deploy-gpu.sh
```

---

## 🛠️ 故障排查

### 问题 1：SSH 连接失败

```bash
# 检查 SSH 配置
ssh -p 60022 ubuntu@49.234.30.246

# 检查密钥
ssh-add -l

# 添加密钥
ssh-add ~/.ssh/id_rsa
```

### 问题 2：Docker 安装失败

```bash
# 手动安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 添加用户到 docker 组
sudo usermod -aG docker $USER

# 重新登录
exit
```

### 问题 3：GPU 不可用

```bash
# 检查驱动
nvidia-smi

# 检查 Docker GPU 支持
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi

# 重新安装 NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 问题 4：Python 版本不兼容

```bash
# 安装特定版本的 Python
sudo apt-get install -y python3.10 python3.10-venv python3.10-dev

# 创建符号链接
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1
```

---

## 📝 日志和调试

### 启用详细日志

```bash
# 设置 bash 调试模式
bash -x ./scripts/remote-deploy-gpu.sh

# 或在脚本开头添加
set -x
```

### 查看部署日志

```bash
# 在服务器上查看日志
ssh -p 60022 ubuntu@49.234.30.246 'cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs -f'
```

---

## 🔒 安全建议

### 1. SSH 密钥认证

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 复制公钥到服务器
ssh-copy-id -p 60022 ubuntu@49.234.30.246
```

### 2. 限制 sudo 权限

脚本需要 sudo 权限来安装依赖，建议配置 sudoers：

```bash
# 编辑 sudoers
sudo visudo

# 添加（允许无密码执行特定命令）
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/systemctl, /usr/bin/usermod
```

### 3. 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3005/tcp
sudo ufw enable
```

---

## 📚 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md)
- [Docker 配置审查](./DOCKER_CONFIGURATION_REVIEW.md)
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)

---

## 🎯 最佳实践

### 1. 首次部署

1. 先在测试服务器上验证
2. 确保有服务器的完整访问权限
3. 准备好 Git 仓库地址
4. 配置好 SSH 密钥认证

### 2. 生产部署

1. 在非高峰时段部署
2. 提前通知用户
3. 确保有完整备份
4. 准备回滚方案

### 3. 定期维护

1. 定期更新系统依赖
2. 监控 GPU 使用情况
3. 清理旧的 Docker 镜像
4. 检查日志文件大小

---

**最后更新**：2025-02-10  
**版本**：2.0（增强版）  
**状态**：✅ 生产就绪
