# Docker 配置完整审查报告

## 📋 审查概述

本文档对项目的 Docker 配置进行全面审查，确保所有配置正确且适合 Tesla P40 GPU 生产环境部署。

---

## ✅ 配置文件清单

### 核心配置文件
- ✅ `Dockerfile` - 主构建文件（GPU 支持）
- ✅ `docker-compose.yml` - 通用配置
- ✅ `docker-compose.gpu.yml` - GPU 专用配置（**推荐用于生产**）
- ✅ `docker-compose.production.yml` - 完整生产配置
- ✅ `.dockerignore` - 构建排除文件
- ✅ `.env.production.example` - 环境变量模板
- ✅ `nginx/nginx.conf.example` - Nginx 配置示例

---

## 🔍 详细审查结果

### 1. Dockerfile 配置

#### ✅ 优点
1. **多阶段构建**：使用 `base` → `deps` → `runtime` 三阶段，优化镜像大小
2. **GPU 支持**：基于 `nvidia/cuda:12.1.1-cudnn-runtime-ubuntu22.04`，支持 Tesla P40
3. **非 root 用户**：使用 UID/GID 1001 运行，提高安全性
4. **健康检查**：内置健康检查机制
5. **Python 环境**：正确配置 Kokoro TTS 的 Python 虚拟环境
6. **PyTorch GPU**：安装 CUDA 12.1 版本的 PyTorch

#### ⚠️ 发现的问题

**问题 1：缺少 espeak-ng 依赖**
- **影响**：Kokoro TTS 无法正常工作
- **严重性**：高
- **状态**：需要修复

**问题 2：CUDA 版本选择**
- **当前**：CUDA 12.1
- **Tesla P40 支持**：CUDA 11.8 - 12.x
- **建议**：检查服务器驱动版本
  - 驱动 >= 530：可以使用 CUDA 12.1
  - 驱动 < 530：需要降级到 CUDA 11.8

---

### 2. docker-compose.gpu.yml 配置

#### ✅ 优点
1. **GPU 资源配置正确**
2. **服务分离清晰**（migrate, app, admin）
3. **卷挂载正确**
4. **环境变量管理规范**

#### ❌ 发现的严重问题

**问题 1：migrate 服务的 build target 错误**
```yaml
# 当前配置（错误）
migrate:
  build:
    target: deps  # ❌ deps 阶段没有 Prisma CLI

# 应该是
migrate:
  build:
    target: runtime  # ✅ 或者使用已构建的镜像
```

**修复方案**：migrate 服务应该使用 runtime 镜像或直接使用 app 镜像

---

### 3. 环境变量配置

#### ✅ .env.production.example 完整性

必需配置项都已包含：
- ✅ `CEREBRAS_API_KEY`
- ✅ `JWT_SECRET`
- ✅ `DATABASE_URL`
- ✅ `ADMIN_EMAIL` / `ADMIN_PASSWORD`

#### ⚠️ 建议添加的 GPU 相关配置

```bash
# GPU 设备配置
KOKORO_DEVICE=cuda
NVIDIA_VISIBLE_DEVICES=all
CUDA_VISIBLE_DEVICES=0

# TTS 并发配置（Tesla P40 有 24GB 显存，可以提高并发）
KOKORO_TTS_MAX_CONCURRENCY=4

# Python 环境
KOKORO_VENV=/app/kokoro-local/venv
PYTHONPATH=/app/kokoro-main-ref:/app/kokoro-main-ref/kokoro.js
```

---

### 4. Nginx 配置

#### ✅ 配置完整性
- ✅ HTTP → HTTPS 重定向
- ✅ SSL/TLS 安全配置
- ✅ 速率限制
- ✅ TTS API 超时（120s）
- ✅ 静态文件缓存

#### ⚠️ Docker 环境需要调整

如果在 Docker Compose 中使用 Nginx，需要修改上游服务器地址：
```nginx
upstream app_backend {
    # Docker 内部网络
    server app:3000;  # 而不是 127.0.0.1:3000
}
```

---

## 🔧 必需的修改清单

### 高优先级（必须修复）

#### 修改 1：Dockerfile 添加 espeak-ng

**位置**：`Dockerfile` 第 30 行左右

**当前代码**：
```dockerfile
 && apt-get install -y --no-install-recommends \
    build-essential \
    dumb-init \
    git \
    nodejs \
    pkg-config \
    python3 \
    python3-dev \
    python3-distutils \
    python3-venv \
    python3-pip \
    unzip \
    wget \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    sox \
    libgl1 \
    libglib2.0-0 \
    zlib1g-dev \
```

**修改为**：
```dockerfile
 && apt-get install -y --no-install-recommends \
    build-essential \
    dumb-init \
    git \
    nodejs \
    pkg-config \
    python3 \
    python3-dev \
    python3-distutils \
    python3-venv \
    python3-pip \
    unzip \
    wget \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    sox \
    libgl1 \
    libglib2.0-0 \
    zlib1g-dev \
    espeak-ng \
```

#### 修改 2：docker-compose.gpu.yml 修复 migrate 服务

**位置**：`docker-compose.gpu.yml` migrate 服务配置

**当前代码**：
```yaml
migrate:
  image: ${IMAGE_TAG:-english-listening-trainer:gpu}
  build:
    context: .
    dockerfile: Dockerfile
    target: deps
  command: ["npx", "prisma", "migrate", "deploy"]
```

**修改为**：
```yaml
migrate:
  image: ${IMAGE_TAG:-english-listening-trainer:gpu}
  build:
    context: .
    dockerfile: Dockerfile
    target: runtime
  command: ["npx", "prisma", "migrate", "deploy"]
```

---

### 中优先级（建议修改）

#### 修改 3：添加 GPU 环境变量到 .env.production.example

在文件末尾添加：
```bash
# ================================
# GPU 和 TTS 优化配置
# ================================

# GPU 设备选择（cuda/cpu/mps）
KOKORO_DEVICE=cuda

# NVIDIA GPU 可见性
NVIDIA_VISIBLE_DEVICES=all

# CUDA 设备选择（0 表示第一块 GPU）
CUDA_VISIBLE_DEVICES=0

# TTS 最大并发数（Tesla P40 24GB 显存建议 4-6）
KOKORO_TTS_MAX_CONCURRENCY=4

# Python 虚拟环境路径
KOKORO_VENV=/app/kokoro-local/venv

# Python 模块搜索路径
PYTHONPATH=/app/kokoro-main-ref:/app/kokoro-main-ref/kokoro.js

# PyTorch 配置
PYTORCH_ENABLE_MPS_FALLBACK=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
```

---

### 低优先级（可选优化）

#### 优化 1：添加 Docker 构建缓存优化

在 `Dockerfile` 中添加构建参数：
```dockerfile
# 在 FROM 之后添加
ARG BUILDKIT_INLINE_CACHE=1
```

#### 优化 2：添加健康检查脚本

创建 `scripts/docker-health-check.sh`：
```bash
#!/bin/bash
# Docker 容器健康检查脚本

# 检查 Next.js 服务
if ! curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
  exit 1
fi

# 检查 GPU 可用性（如果是 GPU 容器）
if [ "${KOKORO_DEVICE}" = "cuda" ]; then
  if ! python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
    echo "GPU not available"
    exit 1
  fi
fi

exit 0
```

---

## 📊 配置兼容性矩阵

### CUDA 版本兼容性

| 组件 | CUDA 11.8 | CUDA 12.1 | 推荐 |
|------|-----------|-----------|------|
| Tesla P40 | ✅ 完全支持 | ✅ 完全支持 | 12.1 |
| PyTorch 2.3.0 | ✅ 支持 | ✅ 支持 | 12.1 |
| Ubuntu 22.04 | ✅ 支持 | ✅ 支持 | 12.1 |
| 驱动要求 | >= 450 | >= 530 | 检查服务器 |

### 服务器驱动检查命令

```bash
# 检查 NVIDIA 驱动版本
nvidia-smi --query-gpu=driver_version --format=csv,noheader

# 检查支持的 CUDA 版本
nvidia-smi | grep "CUDA Version"
```

**决策指南**：
- 驱动 >= 530：使用 CUDA 12.1（当前配置）
- 驱动 450-529：降级到 CUDA 11.8
- 驱动 < 450：需要升级驱动

---

## 🚀 部署前检查清单

### 必须完成
- [ ] 修复 Dockerfile 添加 espeak-ng
- [ ] 修复 docker-compose.gpu.yml migrate 服务
- [ ] 创建 .env.production 文件
- [ ] 配置 CEREBRAS_API_KEY
- [ ] 配置 JWT_SECRET（使用 `openssl rand -hex 32` 生成）
- [ ] 设置管理员密码

### 服务器环境检查
- [ ] 检查 NVIDIA 驱动版本
- [ ] 安装 NVIDIA Container Toolkit
- [ ] 测试 Docker GPU 支持
- [ ] 检查磁盘空间（至少 20GB）
- [ ] 检查内存（至少 8GB）

### 可选但推荐
- [ ] 配置 Nginx 反向代理
- [ ] 设置 SSL 证书
- [ ] 配置防火墙规则
- [ ] 设置自动备份
- [ ] 配置日志轮转

---

## 📝 部署命令参考

### 检查服务器 GPU 环境
```bash
# 检查驱动
nvidia-smi

# 测试 Docker GPU 支持
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

### 构建和部署
```bash
# 1. 创建必需目录
mkdir -p data public/audio logs backups

# 2. 配置环境变量
cp .env.production.example .env.production
nano .env.production  # 编辑配置

# 3. 构建镜像
docker compose -f docker-compose.gpu.yml build app

# 4. 运行数据库迁移
docker compose -f docker-compose.gpu.yml run --rm migrate

# 5. 启动应用
docker compose -f docker-compose.gpu.yml up -d app

# 6. 查看日志
docker compose -f docker-compose.gpu.yml logs -f app

# 7. 检查状态
docker compose -f docker-compose.gpu.yml ps
```

### 验证部署
```bash
# 健康检查
curl http://localhost:3000/api/health

# 检查 GPU 使用
nvidia-smi

# 测试 TTS
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"af_heart"}'
```

---

## 🔒 安全建议

### 生产环境必须
1. **修改默认密码**：部署后立即修改管理员密码
2. **使用强 JWT 密钥**：至少 32 字节随机字符串
3. **配置防火墙**：只开放必要端口（80, 443, 3000）
4. **启用 HTTPS**：使用 Let's Encrypt 或其他 SSL 证书
5. **定期更新**：保持系统和依赖包更新

### 推荐配置
1. **限制容器资源**：防止资源耗尽
2. **配置日志轮转**：防止磁盘占满
3. **设置备份策略**：定期备份数据库和重要文件
4. **监控 GPU 使用**：防止过热或过载
5. **配置告警**：及时发现问题

---

## 📚 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md) - 完整部署流程
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md) - 部署前检查项
- [故障排查指南](./TROUBLESHOOTING.md) - 常见问题解决

---

## 🎯 总结

### 当前状态
- ✅ 整体配置良好，适合生产环境
- ⚠️ 有 2 个必须修复的问题
- 💡 有几个可选的优化建议

### 必须修复的问题
1. **Dockerfile 缺少 espeak-ng**（高优先级）
2. **docker-compose.gpu.yml migrate 服务配置错误**（高优先级）

### 修复后即可部署
完成上述 2 个必须修复的问题后，配置即可用于生产环境部署。

### 下一步
1. 应用本文档中的必需修改
2. 在服务器上检查 GPU 环境
3. 按照部署指南执行部署
4. 运行健康检查验证部署

---

**最后更新**：2025-02-10
**审查人**：Kiro AI Assistant
**状态**：待修复 → 可部署
