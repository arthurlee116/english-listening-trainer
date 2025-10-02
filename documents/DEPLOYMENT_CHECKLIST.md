# 部署检查清单

## 部署前检查 ✓

### 本地准备
- [ ] 代码已提交到 Git
- [ ] 所有测试通过
- [ ] 环境变量已配置
- [ ] 文档已更新

### 服务器信息确认
- [ ] 服务器 IP: 49.234.30.246
- [ ] SSH 端口: 60022
- [ ] 用户名: ubuntu
- [ ] 密码: Abcd.1234
- [ ] GPU: Tesla P40

## 快速部署（推荐）

### 方式 1: 使用自动化脚本

```bash
# 1. 提交代码
git add .
git commit -m "准备部署"
git push origin main

# 2. 运行自动部署脚本
./scripts/remote-deploy-gpu.sh

# 脚本会自动完成:
# - 检查本地和远程环境
# - 推送代码
# - 在服务器上拉取代码
# - 备份数据
# - 构建和启动服务
# - 运行健康检查
```

### 方式 2: 手动部署

```bash
# 1. 本地提交并推送
git add .
git commit -m "准备部署"
git push origin main

# 2. 连接到服务器
ssh -p 60022 ubuntu@49.234.30.246

# 3. 进入项目目录
cd ~/english-listening-trainer  # 根据实际路径调整

# 4. 执行部署
./scripts/deploy-gpu.sh

# 或手动步骤:
docker compose -f docker-compose.gpu.yml down
git pull origin main
docker compose -f docker-compose.gpu.yml build app
docker compose -f docker-compose.gpu.yml run --rm migrate
docker compose -f docker-compose.gpu.yml up -d app
```

## 详细部署步骤

### 步骤 1: 连接服务器

```bash
ssh -p 60022 ubuntu@49.234.30.246
```

### 步骤 2: 检查环境

```bash
# 检查 GPU
nvidia-smi

# 检查 Docker
docker --version
docker compose version

# 检查 Python
python3 --version
```

### 步骤 3: 进入项目并备份

```bash
cd ~/english-listening-trainer  # 根据实际路径调整

# 备份数据库
cp data/app.db data/app.db.backup.$(date +%Y%m%d_%H%M%S)

# 或使用备份脚本
./scripts/backup.sh --compress
```

### 步骤 4: 更新代码

```bash
# 停止服务
docker compose -f docker-compose.gpu.yml down

# 拉取代码
git pull origin main

# 查看更新
git log -5 --oneline
```

### 步骤 5: 配置环境变量

```bash
# 检查配置文件
cat .env.production

# 如果不存在，创建并编辑
cp .env.production.example .env.production
nano .env.production
```

必需配置：
```bash
CEREBRAS_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret
DATABASE_URL=file:/app/data/app.db
KOKORO_DEVICE=cuda
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123456
```

### 步骤 6: 设置 TTS 环境

```bash
# 检查 GPU 环境
PYTHON_BIN=python3 ./scripts/gpu-environment-check.sh

# 设置 Kokoro TTS
./scripts/setup-kokoro-complete.sh
```

### 步骤 7: 部署应用

```bash
# 使用部署脚本（推荐）
./scripts/deploy-gpu.sh

# 或手动执行
docker compose -f docker-compose.gpu.yml build app
docker compose -f docker-compose.gpu.yml run --rm migrate
docker compose -f docker-compose.gpu.yml up -d app
```

### 步骤 8: 验证部署

```bash
# 查看服务状态
docker compose -f docker-compose.gpu.yml ps

# 查看日志
docker compose -f docker-compose.gpu.yml logs -f app

# 健康检查
curl http://localhost:3000/api/health

# 测试 TTS
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","voice":"af_heart"}'
```

## 部署后检查 ✓

### 服务状态
- [ ] Docker 容器运行正常
- [ ] 应用端口 3000 可访问
- [ ] 健康检查接口返回 200
- [ ] GPU 被正确识别和使用

### 功能测试
- [ ] 用户可以登录
- [ ] AI 内容生成正常
- [ ] TTS 音频生成正常
- [ ] 数据库读写正常
- [ ] 管理后台可访问（端口 3005）

### 性能检查
- [ ] GPU 使用率正常（nvidia-smi）
- [ ] 内存使用合理
- [ ] 响应时间正常
- [ ] 日志无异常错误

## 常见问题处理

### GPU 不可用
```bash
# 检查驱动
nvidia-smi

# 检查 Docker GPU 支持
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# 安装 NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### TTS 初始化失败
```bash
# 重新安装 PyTorch
./scripts/install-pytorch-gpu.sh --recreate --cuda-version 11.8

# 检查 Python 环境
cd kokoro-local
source venv/bin/activate
python -c "import torch; print(torch.cuda.is_available())"
```

### 端口被占用
```bash
# 查看端口占用
sudo lsof -i :3000

# 停止占用进程
sudo kill -9 <PID>
```

### 数据库问题
```bash
# 手动运行迁移
docker compose -f docker-compose.gpu.yml run --rm app npx prisma migrate deploy

# 重置数据库（谨慎！）
docker compose -f docker-compose.gpu.yml run --rm app npx prisma migrate reset
```

## 回滚操作

```bash
# 查看提交历史
git log --oneline

# 回滚到指定提交
git checkout <commit-hash>

# 重新部署
docker compose -f docker-compose.gpu.yml down
docker compose -f docker-compose.gpu.yml up -d --build
```

## 监控命令

```bash
# 实时查看日志
docker compose -f docker-compose.gpu.yml logs -f

# 查看容器状态
docker compose -f docker-compose.gpu.yml ps

# 查看资源使用
docker stats

# 查看 GPU 使用
watch -n 1 nvidia-smi

# 进入容器调试
docker compose -f docker-compose.gpu.yml exec app sh
```

## 维护任务

### 定期清理
```bash
# 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete

# 清理旧音频
find public/audio/ -name "*.wav" -mtime +7 -delete

# 清理 Docker
docker system prune -a
```

### 定期备份
```bash
# 手动备份
./scripts/backup.sh --compress

# 设置定时备份（crontab）
0 2 * * * cd /path/to/project && ./scripts/backup.sh --compress
```

## 访问信息

- **应用地址**: http://49.234.30.246:3000
- **管理后台**: http://49.234.30.246:3005
- **默认管理员**: 在 .env.production 中配置

## 安全提醒

- [ ] 修改默认管理员密码
- [ ] 配置防火墙规则
- [ ] 考虑使用 Nginx 反向代理
- [ ] 配置 SSL 证书（HTTPS）
- [ ] 定期更新系统和依赖
- [ ] 设置自动备份策略

## 下一步优化

1. **配置 Nginx 反向代理**
   - 隐藏端口号
   - 配置 SSL/TLS
   - 负载均衡（如需要）

2. **监控和告警**
   - 配置日志收集
   - 设置性能监控
   - 配置告警通知

3. **自动化运维**
   - CI/CD 流水线
   - 自动化测试
   - 自动化部署

4. **性能优化**
   - 调整 GPU 并发数
   - 优化数据库查询
   - 配置缓存策略
