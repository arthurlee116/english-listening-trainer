# 远程服务器部署指南

## 概述

本指南提供完整的远程服务器部署流程，特别针对已实现CI/Docker缓存优化和TTS模块重构的项目。包含处理本地未提交更改、远程服务器旧版本构建、版本冲突等场景的最佳实践。

## 前置条件

### 本地环境要求
- Git 2.30+
- Node.js 18+
- Docker 20.10+
- SSH 客户端
- 服务器SSH访问权限

### 远程服务器要求
- Ubuntu 20.04+ / CentOS 8+
- Docker 20.10+
- Docker Compose 2.0+
- NVIDIA驱动（GPU服务器）
- 至少4GB可用磁盘空间

## 部署方式选择

### 1. 基于Docker镜像部署（推荐）
**适用场景**：生产环境、CI/CD自动化、多环境部署

**优势**：
- 利用多级缓存，部署速度快（<300MB下载量）
- 环境一致性保证
- 支持GPU加速
- 易于回滚

**使用脚本**：
- [`scripts/deploy-from-ghcr.sh`](scripts/deploy-from-ghcr.sh) - 主要部署脚本
- [`scripts/remote-cache-prewarm.sh`](scripts/remote-cache-prewarm.sh) - 缓存预热
- [`scripts/verify-cache-layers.sh`](scripts/verify-cache-layers.sh) - 缓存验证

### 2. 基于Git拉取部署
**适用场景**：开发环境、快速迭代、需要源码调试

**优势**：
- 直接获取最新源码
- 便于本地调试
- 无需镜像构建

**使用脚本**：
- [`scripts/remote-deploy-gpu.sh`](scripts/remote-deploy-gpu.sh) - GPU服务器部署
- [`scripts/remote-deploy.sh`](scripts/remote-deploy.sh) - 通用部署

---

## 完整部署流程

### 阶段1：本地环境检查与准备

#### 1.1 检查Git状态

```bash
# 查看当前Git状态
git status

# 查看未提交的更改
git diff

# 查看未暂存的文件
git diff --name-only

# 查看已暂存但未提交的文件
git diff --cached --name-only
```

#### 1.2 处理本地未提交更改

**选项A：提交所有更改（推荐）**

```bash
# 添加所有更改
git add .

# 提交更改（使用约定式提交）
git commit -m "feat: 添加远程缓存预热功能

- 创建 remote-cache-prewarm.sh 实现多级缓存预热
- 创建 verify-cache-layers.sh 验证缓存层完整性
- 修改 deploy-from-ghcr.sh 集成缓存预热步骤
- 统一 Dockerfile NODE_MAJOR 版本为 20

Closes #缓存优化"
```

**选项B：暂存更改（临时保存）**

```bash
# 暂存所有更改
git stash push -m "部署前暂存 $(date '+%Y-%m-%d %H:%M:%S')"

# 查看暂存列表
git stash list

# 恢复暂存（部署后）
git stash pop
```

**选项C：丢弃更改（谨慎使用）**

```bash
# 丢弃工作目录更改
git checkout -- .

# 丢弃暂存区更改
git reset HEAD
```

#### 1.3 同步远程仓库

```bash
# 获取远程最新状态
git fetch origin

# 查看本地与远程差异
git log HEAD..origin/main --oneline

# 合并远程更改（如有冲突需解决）
git pull origin main
```

### 阶段2：远程服务器环境检查

#### 2.1 测试SSH连接

```bash
# 测试基本连接
ssh -p 60022 ubuntu@49.234.30.246 "echo '连接成功'"

# 检查Docker状态
ssh -p 60022 ubuntu@49.234.30.246 "docker --version && docker compose version"

# 检查GPU状态（如适用）
ssh -p 60022 ubuntu@49.234.30.246 "nvidia-smi"
```

#### 2.2 检查磁盘空间

```bash
# 检查根目录可用空间
ssh -p 60022 ubuntu@49.234.30.246 "df -h /"

# 检查Docker空间使用
ssh -p 60022 ubuntu@49.234.30.246 "docker system df"
```

#### 2.3 备份现有数据（重要）

```bash
# 备份数据库（自动修复权限）
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && ./scripts/backup.sh --compress"

# 如果备份失败，手动修复权限后重试
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && sudo mkdir -p backups && sudo chown -R \$(whoami):\$(whoami) backups && sudo chmod -R 755 backups && ./scripts/backup.sh --compress"

# 备份配置文件
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && cp .env.production .env.production.backup.\$(date +%Y%m%d_%H%M%S)"

# 清理旧备份文件（释放磁盘空间）
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && ./scripts/backup.sh --cleanup"

# 或者直接删除旧备份目录（简单粗暴）
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && rm -rf backups/* && ./scripts/backup.sh --compress"
```

### 阶段3：基于Docker镜像部署（推荐）

#### 3.1 缓存预热（首次部署或缓存失效时）

```bash
# 执行缓存预热
./scripts/remote-cache-prewarm.sh

# 验证缓存层
./scripts/verify-cache-layers.sh
```

#### 3.2 执行部署

```bash
# 部署最新版本
./scripts/deploy-from-ghcr.sh

# 部署指定版本
./scripts/deploy-from-ghcr.sh v1.2.3
```

#### 3.3 部署验证

```bash
# 检查服务状态
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml ps"

# 查看服务日志
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs -f app"

# 健康检查
curl -f http://49.234.30.246:3000/api/health
```

### 阶段4：基于Git拉取部署

#### 4.1 完整部署（首次）

```bash
# 使用自动化脚本
./scripts/remote-deploy-gpu.sh --host 49.234.30.246 --port 60022 --branch main

# 手动指定仓库（首次部署）
./scripts/remote-deploy-gpu.sh --repo https://github.com/arthurlee116/english-listening-trainer.git
```

#### 4.2 更新部署（已有项目）

```bash
# 仅更新代码
./scripts/remote-deploy-gpu.sh --update

# 运行测试后部署
./scripts/remote-deploy-gpu.sh --run-tests
```

---

## 版本冲突处理

### 场景1：本地与远程分支分歧

```bash
# 查看分歧点
git log --oneline --graph --decorate --boundary origin/main...HEAD

# 选项A：合并远程更改
git fetch origin
git merge origin/main

# 选项B：变基到远程
git fetch origin
git rebase origin/main

# 选项C：强制推送（谨慎使用）
git push --force-with-lease origin main
```

### 场景2：远程服务器代码未更新

```bash
# 检查远程服务器当前版本
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && git log -1 --oneline"

# 强制拉取最新代码
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && git fetch origin && git reset --hard origin/main"

# 清理未跟踪的文件
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && git clean -fd"
```

### 场景3：Docker镜像版本冲突

```bash
# 查看本地镜像
ssh -p 60022 ubuntu@49.234.30.246 "docker images | grep english-listening-trainer"

# 清理旧镜像
ssh -p 60022 ubuntu@49.234.30.246 "docker image prune -f"

# 拉取指定镜像
ssh -p 60022 ubuntu@49.234.30.246 "docker pull ghcr.io/arthurlee116/english-listening-trainer:latest"
```

---

## 回滚策略

### 快速回滚（Docker镜像）

```bash
# 查看可用镜像版本
ssh -p 60022 ubuntu@49.234.30.246 "docker images | grep english-listening-trainer"

# 回滚到上一个版本
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && IMAGE_TAG=ghcr.io/arthurlee116/english-listening-trainer:previous docker compose -f docker-compose.gpu.yml up -d"

# 使用脚本回滚
./scripts/deploy-from-ghcr.sh v1.2.2
```

### 完整回滚（Git代码）

```bash
# 回滚到上一个提交
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && git checkout HEAD~1"

# 回滚到指定提交
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && git checkout <commit-hash>"

# 重新构建和部署
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml build && docker compose -f docker-compose.gpu.yml up -d"
```

### 数据库回滚

```bash
# 查看备份文件
ssh -p 60022 ubuntu@49.234.30.246 "ls -la ~/english-listening-trainer/backups/"

# 恢复数据库备份
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && ./scripts/restore.sh backup_20231012_143022.sql"
```

---

## 故障排除

### 常见问题及解决方案

#### 1. SSH连接失败

```bash
# 检查SSH配置
ssh -v -p 60022 ubuntu@49.234.30.246

# 检查防火墙
telnet 49.234.30.246 60022

# 重置SSH密钥
ssh-keygen -R 49.234.30.246
```

#### 2. Docker拉取镜像失败

```bash
# 检查Docker登录状态
ssh -p 60022 ubuntu@49.234.30.246 "docker info | grep Registry"

# 登录到GHCR
ssh -p 60022 ubuntu@49.234.30.246 "docker login ghcr.io -u <username> -p <token>"

# 配置镜像加速器
ssh -p 60022 ubuntu@49.234.30.246 "sudo tee /etc/docker/daemon.json <<EOF
{
  \"registry-mirrors\": [\"https://docker.mirrors.ustc.edu.cn\"]
}
EOF"
```

#### 3. 缓存预热失败

```bash
# 检查磁盘空间
ssh -p 60022 ubuntu@49.234.30.246 "df -h /"

# 清理Docker缓存
ssh -p 60022 ubuntu@49.234.30.246 "docker system prune -a"

# 手动拉取缓存层
ssh -p 60022 ubuntu@49.234.30.246 "docker pull ghcr.io/arthurlee116/english-listening-trainer:cache-base"
```

#### 4. 备份权限问题

```bash
# 检查备份目录权限
ssh -p 60022 ubuntu@49.234.30.246 "ls -la ~/english-listening-trainer/backups"

# 手动修复权限
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && sudo mkdir -p backups && sudo chown -R \$(whoami):\$(whoami) backups && sudo chmod -R 755 backups"

# 清理旧备份后重新备份
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && rm -rf backups/* && ./scripts/backup.sh --compress"

# 检查磁盘空间
ssh -p 60022 ubuntu@49.234.30.246 "df -h ~/ && du -sh ~/english-listening-trainer/backups"
```

#### 5. 应用启动失败

```bash
# 查看详细日志
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs app"

# 检查环境变量
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && cat .env.production"

# 检查端口占用
ssh -p 60022 ubuntu@49.234.30.246 "netstat -tlnp | grep 3000"
```

#### 6. GPU不可用

```bash
# 检查NVIDIA驱动
ssh -p 60022 ubuntu@49.234.30.246 "nvidia-smi"

# 检查Docker GPU支持
ssh -p 60022 ubuntu@49.234.30.246 "docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi"

# 重启NVIDIA服务
ssh -p 60022 ubuntu@49.234.30.246 "sudo systemctl restart nvidia-persistenced"
```

---

## 性能优化

### 缓存策略

1. **多级缓存利用**
   - cache-base: 基础系统环境（~1.2GB）
   - cache-python: Python依赖（~800MB）
   - cache-node: Node.js依赖（~600MB）
   - runtime: 业务代码（<300MB）

2. **缓存预热时机**
   - 首次部署前
   - 大版本更新后
   - 缓存失效时

3. **缓存维护**
   ```bash
   # 定期清理未使用镜像
   ssh -p 60022 ubuntu@49.234.30.246 "docker image prune -f --filter 'until=72h'"
   
   # 验证缓存完整性
   ./scripts/verify-cache-layers.sh
   ```

### 网络优化

1. **使用镜像加速器**
2. **压缩传输数据**
3. **并行下载层**

### 存储优化

1. **日志轮转**
2. **数据库定期备份**
3. **临时文件清理**

---

## 安全最佳实践

### 1. 访问控制

```bash
# 使用SSH密钥而非密码
ssh -i ~/.ssh/id_rsa -p 60022 ubuntu@49.234.30.246

# 限制SSH访问IP
ssh -p 60022 ubuntu@49.234.30.246 "sudo ufw allow from <your-ip> to any port 60022"
```

### 2. 密钥管理

```bash
# 使用环境变量存储敏感信息
export CEREBRAS_API_KEY="your-api-key"

# 使用Docker secrets（生产环境）
echo "your-secret" | docker secret create my-secret -
```

### 3. 网络安全

```bash
# 配置防火墙
ssh -p 60022 ubuntu@49.234.30.246 "sudo ufw enable && sudo ufw allow 3000/tcp && sudo ufw allow 3005/tcp"

# 使用HTTPS（生产环境）
# 配置Nginx反向代理和SSL证书
```

---

## 监控和维护

### 1. 健康检查

```bash
# 应用健康检查
curl -f http://49.234.30.246:3000/api/health
```

### 2. 日志管理

```bash
# 查看实时日志
ssh -p 60022 ubuntu@49.234.30.246 "cd ~/english-listening-trainer && docker compose -f docker-compose.gpu.yml logs -f"

# 日志轮转配置
ssh -p 60022 ubuntu@49.234.30.246 "sudo nano /etc/logrotate.d/docker-containers"
```

### 3. 性能监控

```bash
# 系统资源监控
ssh -p 60022 ubuntu@49.234.30.246 "top && df -h && free -h"

# Docker资源监控
ssh -p 60022 ubuntu@49.234.30.246 "docker stats"
```

---

## 自动化建议

### 1. CI/CD集成

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: ./scripts/deploy-from-ghcr.sh
```

### 2. 定时任务

```bash
# 添加到crontab
# 每天凌晨2点备份
0 2 * * * cd ~/english-listening-trainer && ./scripts/backup.sh --compress

# 每周日凌晨3点清理缓存
0 3 * * 0 docker system prune -f
```

### 3. 监控告警

```bash
# 使用Prometheus + Grafana
# 或简单的健康检查脚本
#!/bin/bash
if ! curl -f http://localhost:3000/api/health; then
    echo "应用健康检查失败" | mail -s "告警" admin@example.com
fi
```

---

## 总结

本指南提供了完整的远程服务器部署流程，涵盖了从本地环境准备到生产环境维护的所有关键步骤。通过遵循这些最佳实践，可以确保部署的可靠性、安全性和效率。

关键要点：
1. **始终处理本地未提交更改**，避免部署不一致代码
2. **利用多级缓存优化**，显著提升部署速度
3. **实施完善的备份策略**，确保数据安全
4. **建立监控告警机制**，及时发现问题
5. **定期维护和优化**，保持系统健康运行

如需更多帮助，请参考项目文档或联系技术支持团队。