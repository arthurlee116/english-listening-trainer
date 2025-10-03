# 🚀 部署快速参考

## 一键部署命令

```bash
# 标准部署（推荐）
./scripts/remote-deploy-gpu.sh

# 首次部署（需要指定仓库）
./scripts/remote-deploy-gpu.sh --repo https://github.com/your-username/your-repo.git
```

---

## 📋 部署前检查清单

- [ ] 本地代码已提交并推送
- [ ] SSH 可以连接到服务器
- [ ] 服务器有足够的磁盘空间（至少 20GB）
- [ ] 已准备好 `.env.production` 配置

---

## 🔑 必需的环境变量

在服务器上创建 `.env.production`：

```bash
# AI 服务
CEREBRAS_API_KEY=你的API密钥

# 认证
JWT_SECRET=$(openssl rand -hex 32)

# 数据库
DATABASE_URL=file:/app/data/app.db

# GPU
KOKORO_DEVICE=cuda
NVIDIA_VISIBLE_DEVICES=all

# 管理员
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=强密码
```

---

## 🛠️ 常用命令

### 部署相关

```bash
# 标准部署
./scripts/remote-deploy-gpu.sh

# 跳过 GPU 检查
./scripts/remote-deploy-gpu.sh --skip-gpu-check

# 不自动安装依赖
./scripts/remote-deploy-gpu.sh --no-auto-install

# 指定分支
./scripts/remote-deploy-gpu.sh --branch develop
```

### 服务器操作

```bash
# 连接服务器
ssh -p 60022 ubuntu@49.234.30.246

# 查看服务状态
docker compose -f docker-compose.gpu.yml ps

# 查看日志
docker compose -f docker-compose.gpu.yml logs -f app

# 重启服务
docker compose -f docker-compose.gpu.yml restart

# 停止服务
docker compose -f docker-compose.gpu.yml down

# 启动服务
docker compose -f docker-compose.gpu.yml up -d
```

### 健康检查

```bash
# API 健康检查
curl http://localhost:3000/api/health

# GPU 检查
nvidia-smi

# 容器内健康检查
docker compose -f docker-compose.gpu.yml exec app ./scripts/docker-health-check.sh
```

---

## 🔍 故障排查

### Docker 未安装

```bash
# 脚本会自动安装，或手动执行：
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### GPU 不可用

```bash
# 检查驱动
nvidia-smi

# 检查 Docker GPU 支持
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

### 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000

# 停止占用进程
sudo kill -9 <PID>
```

---

## 📞 访问信息

- **应用**: http://49.234.30.246:3000
- **管理后台**: http://49.234.30.246:3005
- **健康检查**: http://49.234.30.246:3000/api/health

---

## 📚 详细文档

- [远程部署脚本指南](./REMOTE_DEPLOY_SCRIPT_GUIDE.md)
- [完整部署指南](./DEPLOYMENT_GUIDE.md)
- [Docker 配置审查](./DOCKER_CONFIGURATION_REVIEW.md)
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md)

---

**提示**：首次部署可能需要 10-20 分钟（包括依赖安装）
