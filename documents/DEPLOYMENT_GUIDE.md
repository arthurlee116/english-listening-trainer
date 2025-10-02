# 远程服务器部署指南

## 服务器信息
- **系统**: Ubuntu
- **IP**: 49.234.30.246
- **端口**: 60022
- **用户**: ubuntu
- **密码**: Abcd.1234
- **GPU**: NVIDIA Tesla P40

## 部署策略

### 方案选择
由于服务器已有旧版本项目，建议采用**更新部署**而非删除重建：
1. 保留数据库和用户数据
2. 更新代码和依赖
3. 重新构建和启动服务

## 前置准备

### 1. 本地提交代码
```bash
# 在本地执行
git add .
git commit -m "准备部署到生产环境"
git push origin main  # 或你的分支名
```

### 2. 连接到服务器
```bash
ssh -p 60022 ubuntu@49.234.30.246
```

## 部署步骤

### 步骤 1: 检查服务器环境

```bash
# 检查 GPU 驱动
nvidia-smi

# 检查 Docker
docker --version
docker compose version

# 检查 NVIDIA Container Toolkit
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# 检查 Python
python3 --version
```

### 步骤 2: 进入项目目录并备份

```bash
# 进入项目目录（根据实际路径调整）
cd /path/to/your/project

# 创建备份
./scripts/backup.sh --compress

# 或手动备份数据库
cp data/app.db data/app.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 步骤 3: 拉取最新代码

```bash
# 停止当前运行的服务
docker compose -f docker-compose.gpu.yml down

# 或如果使用 PM2
pm2 stop all

# 拉取最新代码
git fetch origin
git pull origin main  # 或你的分支名

# 查看更新内容
git log -5 --oneline
```

### 步骤 4: 检查和配置环境变量

```bash
# 检查 .env.production 文件
cat .env.production

# 如果不存在，从示例创建
cp .env.production.example .env.production

# 编辑配置（重要！）
nano .env.production
```

必需的环境变量：
```bash
# Cerebras API
CEREBRAS_API_KEY=your_api_key_here

# JWT 密钥
JWT_SECRET=your_jwt_secret_here

# 数据库
DATABASE_URL=file:/app/data/app.db

# GPU 配置
KOKORO_DEVICE=cuda
PYTORCH_ENABLE_MPS_FALLBACK=0

# 管理员账号
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator

# 可选：代理配置
# CEREBRAS_PROXY_URL=http://your-proxy:port
```

### 步骤 5: 检查 GPU 环境

```bash
# 运行 GPU 环境检查脚本
PYTHON_BIN=python3 ./scripts/gpu-environment-check.sh
```

如果检查失败，需要安装 NVIDIA Container Toolkit：
```bash
# Ubuntu 安装 NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 步骤 6: 设置 Kokoro TTS 环境

```bash
# 运行完整的 Kokoro 设置脚本
./scripts/setup-kokoro-complete.sh

# 或使用 GPU 专用安装脚本
./scripts/install-pytorch-gpu.sh --python python3 --cuda-version 11.8
```

### 步骤 7: 使用 Docker GPU 部署

```bash
# 使用 GPU 部署脚本（推荐）
./scripts/deploy-gpu.sh

# 或手动执行以下步骤：

# 1. 构建镜像
docker compose -f docker-compose.gpu.yml build app

# 2. 运行数据库迁移
docker compose -f docker-compose.gpu.yml run --rm migrate

# 3. 启动应用
docker compose -f docker-compose.gpu.yml up -d app

# 4. 查看日志
docker compose -f docker-compose.gpu.yml logs -f app
```

### 步骤 8: 验证部署

```bash
# 运行健康检查
./scripts/health-check.sh

# 或手动检查
curl http://localhost:3000/api/health

# 检查容器状态
docker compose -f docker-compose.gpu.yml ps

# 查看 GPU 使用情况
nvidia-smi

# 测试 TTS 功能
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"af_heart"}'
```

### 步骤 9: 启动管理后台（可选）

```bash
# 启动管理后台（端口 3005）
docker compose -f docker-compose.gpu.yml --profile admin up -d admin

# 访问管理后台
# http://your-server-ip:3005
```

## 故障排查

### 问题 1: GPU 不可用

```bash
# 检查 NVIDIA 驱动
nvidia-smi

# 检查 Docker GPU 支持
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# 重启 Docker
sudo systemctl restart docker
```

### 问题 2: TTS 初始化失败

```bash
# 检查 Python 环境
cd kokoro-local
source venv/bin/activate
python -c "import torch; print(torch.cuda.is_available())"

# 重新安装 PyTorch
./scripts/install-pytorch-gpu.sh --recreate --cuda-version 11.8
```

### 问题 3: 数据库迁移失败

```bash
# 手动运行迁移
docker compose -f docker-compose.gpu.yml run --rm app npx prisma migrate deploy

# 或进入容器
docker compose -f docker-compose.gpu.yml exec app sh
npx prisma migrate deploy
```

### 问题 4: 端口被占用

```bash
# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :3005

# 停止占用端口的进程
sudo kill -9 <PID>
```

## 回滚操作

如果部署出现问题，可以快速回滚：

```bash
# 使用部署脚本回滚
./scripts/deploy.sh --rollback deploy_YYYYMMDD_HHMMSS

# 或手动回滚
git log --oneline  # 查看提交历史
git checkout <commit-hash>
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml up -d --build
```

## 性能优化建议

### GPU 内存优化
```bash
# 在 .env.production 中设置
KOKORO_TTS_MAX_CONCURRENCY=4  # Tesla P40 有 24GB 显存，可以增加并发
```

### 日志管理
```bash
# 定期清理日志
find logs/ -name "*.log" -mtime +30 -delete

# 清理旧的音频文件
find public/audio/ -name "*.wav" -mtime +7 -delete
```

## 监控和维护

### 查看应用状态
```bash
# Docker 方式
docker compose -f docker-compose.gpu.yml ps
docker compose -f docker-compose.gpu.yml logs -f app

# 查看资源使用
docker stats

# 查看 GPU 使用
watch -n 1 nvidia-smi
```

### 定期备份
```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * cd /path/to/project && ./scripts/backup.sh --compress
```

## 常用命令速查

```bash
# 启动服务
docker compose -f docker-compose.gpu.yml up -d

# 停止服务
docker compose -f docker-compose.gpu.yml down

# 重启服务
docker compose -f docker-compose.gpu.yml restart

# 查看日志
docker compose -f docker-compose.gpu.yml logs -f

# 进入容器
docker compose -f docker-compose.gpu.yml exec app sh

# 重新构建
docker compose -f docker-compose.gpu.yml up -d --build

# 清理未使用的镜像
docker system prune -a
```

## 安全建议

1. **修改默认密码**: 部署后立即修改管理员密码
2. **配置防火墙**: 只开放必要的端口（3000, 3005）
3. **使用 HTTPS**: 配置 Nginx 反向代理和 SSL 证书
4. **定期更新**: 保持系统和依赖包更新
5. **备份策略**: 定期备份数据库和重要文件

## 下一步

部署完成后：
1. 访问应用: `http://49.234.30.246:3000`
2. 访问管理后台: `http://49.234.30.246:3005`
3. 使用管理员账号登录
4. 测试 TTS 功能
5. 配置 Nginx 反向代理（推荐）
