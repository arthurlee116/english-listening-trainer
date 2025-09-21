# Kokoro TTS 完整安装和使用指南

## 📋 概述

这个脚本提供了从下载模型到配置环境的全流程解决方案，支持 CPU 和 CUDA 两种加速方式。

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd your-project
```

### 2. 运行完整安装脚本
```bash
chmod +x scripts/setup-kokoro-complete.sh
./scripts/setup-kokoro-complete.sh
```

### 3. 安装 Node.js 依赖
```bash
npm install
```

### 4. 启动应用程序
```bash
npm run dev
```

## 📁 脚本功能

### 自动检测和配置
- ✅ 自动检测操作系统 (Linux/macOS/Windows)
- ✅ 自动检测 CUDA 可用性
- ✅ 智能选择 PyTorch 版本 (GPU/CPU)
- ✅ 自动下载 Kokoro 模型和语音文件

### 系统依赖检查
- ✅ Python 3.8+ 版本检查
- ✅ espeak-ng 安装和验证
- ✅ Git 和其他必要工具检测

### Python 环境配置
- ✅ 创建虚拟环境
- ✅ 安装所有必需的 Python 包
- ✅ 配置正确的 PyTorch 版本

### 硬件加速支持
- ✅ **CUDA 加速**: 自动检测 NVIDIA GPU 并安装 GPU 版本 PyTorch
- ✅ **CPU 加速**: 在没有 GPU 的情况下优化 CPU 性能
- ✅ **Apple Silicon**: 支持 M1/M2/M3/M4 的 Metal 加速

## ⚙️ 环境变量配置

脚本会自动在 `.env.local` 文件中配置以下变量（如未事先定义）：

```bash
# PyTorch 配置
PYTORCH_ENABLE_MPS_FALLBACK=1

# Kokoro 设备选择
KOKORO_DEVICE=auto  # 根据脚本检测结果可能写入 cuda/mps/auto

# 并发控制
KOKORO_TTS_MAX_CONCURRENCY=2
```

### 手动配置选项

如果需要手动调整配置，可以修改 `.env.local` 或在运行脚本前导出环境变量：

```bash
# 强制使用 CPU
KOKORO_DEVICE=cpu

# 强制使用 CUDA
KOKORO_DEVICE=cuda

# 使用 Apple Silicon GPU
KOKORO_DEVICE=mps

# 调整并发度 (根据 CPU 核心数调整)
KOKORO_TTS_MAX_CONCURRENCY=4

# 启用调试模式
KOKORO_DEBUG=true

# 自定义 PyTorch 安装行为
KOKORO_TORCH_VARIANT=cuda        # 或 cpu/mps/auto
KOKORO_TORCH_INDEX_URL=https://download.pytorch.org/whl/cu118
KOKORO_TORCH_PACKAGES="torch torchaudio torchvision"

# 自定义 Kokoro 资源路径
KOKORO_REPO_PATH=/opt/kokoro
KOKORO_VOICE_SOURCE=/data/voices
KOKORO_CUDA_HOME=/usr/local/cuda-12.2
KOKORO_HTTP_PROXY=http://proxy.example.com:8080
KOKORO_HTTPS_PROXY=http://proxy.example.com:8080
```

## 🔧 故障排除

### 常见问题

#### 1. Git 克隆失败
```bash
# 解决方案：手动下载并解压
cd kokoro-main-ref/kokoro.js
wget https://github.com/hexgrad/kokoro/archive/refs/heads/main.zip
unzip main.zip
mv kokoro-main/* ./
rm -rf kokoro-main main.zip
```

#### 2. CUDA 检测失败
```bash
# 检查 CUDA 安装
nvidia-smi

# 如果 nvidia-smi 不可用，安装 NVIDIA 驱动
# Ubuntu/Debian:
sudo apt install nvidia-driver-XXX

# 或者强制使用 CPU
echo "KOKORO_DEVICE=cpu" >> .env.local
```

#### 3. espeak-ng 安装失败
```bash
# macOS
brew install espeak-ng

# Ubuntu/Debian
sudo apt install espeak-ng

# CentOS/RHEL
sudo yum install espeak-ng
```

#### 4. PyTorch 安装失败
```bash
# 清理并重新安装
cd kokoro-local
source venv/bin/activate
pip uninstall torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### 验证安装

运行以下命令验证安装：

```bash
cd kokoro-local
source venv/bin/activate
python3 -c "
import torch
print('PyTorch version:', torch.__version__)
print('CUDA available:', torch.cuda.is_available())
print('MPS available:', torch.backends.mps.is_available())
"
```

## 📊 性能对比

| 配置 | 模型加载时间 | 音频生成速度 | 内存使用 |
|------|-------------|-------------|---------|
| CUDA GPU | 2-4秒 | 1-5秒 | ~1-2GB |
| CPU | 3-6秒 | 2-10秒 | ~1-2GB |
| Apple Silicon | 3-5秒 | 2-8秒 | ~1-2GB |

## 🏗️ 项目结构

安装完成后，项目结构如下：

```
your-project/
├── kokoro-local/           # 本地 TTS 服务
│   ├── venv/              # Python 虚拟环境
│   ├── voices/            # 语音文件
│   ├── kokoro_wrapper.py  # Python 包装器
│   └── requirements.txt   # Python 依赖
├── kokoro-main-ref/       # Kokoro 主仓库
│   └── kokoro.js/         # Kokoro 核心代码
├── scripts/
│   ├── setup-kokoro-complete.sh  # 完整安装脚本
│   └── setup-kokoro.sh           # 简化版安装脚本
├── .env.local             # 环境变量配置
└── public/audio/          # 生成的音频文件存储
```

## 🔄 更新和维护

### 更新 Kokoro 模型
```bash
cd kokoro-main-ref/kokoro.js
git pull origin main
```

### 更新 Python 依赖
```bash
cd kokoro-local
source venv/bin/activate
pip install -r requirements.txt --upgrade
```

### 重新运行安装脚本
```bash
./scripts/setup-kokoro-complete.sh
```

## 📞 获取帮助

如果遇到问题，请：

1. 检查脚本输出中的错误信息
2. 验证系统满足最低要求
3. 查看项目文档中的故障排除部分
4. 在 GitHub Issues 中搜索类似问题

## 📝 许可证

请查看项目根目录的 LICENSE 文件了解许可证信息。
