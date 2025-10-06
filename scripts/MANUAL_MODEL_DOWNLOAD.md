# Kokoro 模型手动下载和上传指南

服务器无法访问 HuggingFace，需要手动下载并上传模型。

## 方法一：使用脚本自动下载（推荐）

### 1. 安装 huggingface-cli
```bash
pip install huggingface-hub[cli]
```

### 2. 下载模型到本地
```bash
./scripts/download-kokoro-model.sh
```

### 3. 上传到服务器
```bash
./scripts/upload-kokoro-model.sh
```

## 方法二：使用 git clone

```bash
# 1. 克隆模型仓库
git clone https://huggingface.co/hexgrad/Kokoro-82M ./kokoro-models/Kokoro-82M

# 2. 上传到服务器
./scripts/upload-kokoro-model.sh
```

## 方法三：手动下载文件

### 1. 访问 HuggingFace 页面
https://huggingface.co/hexgrad/Kokoro-82M/tree/main

### 2. 下载以下文件到 `./kokoro-models/Kokoro-82M/`：

**必需文件：**
- `kokoro-v1_0.pth` - 主模型文件（约 82MB）
- `VOICES.md` - 语音配置文档

**可选文件：**
- `README.md` - 说明文档

### 3. 目录结构应该是：
```
./kokoro-models/Kokoro-82M/
├── kokoro-v1_0.pth  (约 82MB)
├── VOICES.md
└── README.md (可选)
```

### 4. 上传到服务器
```bash
./scripts/upload-kokoro-model.sh
```

## 验证上传

上传完成后，SSH 到服务器验证：

```bash
ssh -p 60022 ubuntu@49.234.30.246

# 检查模型文件
cd ~/english-listening-trainer/kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M
ls -lh snapshots/main/

# 应该看到模型文件
```

## 重启服务

```bash
cd ~/english-listening-trainer
docker compose -f docker-compose.gpu.yml restart app

# 查看日志
docker compose -f docker-compose.gpu.yml logs -f app
```

应该看到：
```
✅ Found local model: /app/kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M
📊 Model size: XXX MB
📥 Loading model from local cache...
```

## 故障排除

### 问题：上传失败（磁盘空间不足）
```bash
# 先清理服务器空间
./scripts/emergency-cleanup.sh
```

### 问题：模型文件不完整
检查是否下载了所有必需文件，特别是 `kokoro-v1_0.pth` (约 82MB)

### 问题：权限错误
```bash
# SSH 到服务器，修复权限
ssh -p 60022 ubuntu@49.234.30.246
chmod -R 755 ~/english-listening-trainer/kokoro_local/.cache
```
