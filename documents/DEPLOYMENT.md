# 英语听力训练应用部署文档

## 概述

本文档详细说明如何在生产环境中部署英语听力训练应用。该应用基于 Next.js 15 构建，集成了 Cerebras AI 和本地 Kokoro TTS 引擎。

## 系统要求

### 最低配置
- **CPU**: 2核心，推荐 4核心
- **内存**: 4GB RAM（含 Kokoro TTS 加载需求）
- **存储**: 10GB 可用空间
- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / macOS
- **Python**: 3.8-3.12（Kokoro TTS 不支持 Python 3.13+）
- **Node.js**: 18.0+

### 推荐配置
- **CPU**: 4核心，支持 Apple Silicon（M1/M2/M3）
- **内存**: 8GB RAM
- **存储**: 20GB+ SSD
- **网络**: 稳定的互联网连接（Cerebras API 访问）

## 部署方式

### 方式一：Docker 部署（推荐）

#### 1. 环境准备

```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 项目部署

```bash
# 克隆项目
git clone <your-repository-url>
cd listening-training-app

# 复制环境变量模板
cp .env.production.example .env.production

# 编辑环境变量（重要！）
nano .env.production

# 启动生产环境
docker-compose -f docker-compose.production.yml up -d

# 查看日志
docker-compose -f docker-compose.production.yml logs -f
```

#### 3. SSL 证书配置

```bash
# 使用 Let's Encrypt 获取 SSL 证书
docker run --rm -it \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d your-domain.com

# 更新 Nginx 配置中的证书路径
# 编辑 nginx/nginx.conf 文件
```

### 方式二：手动部署

#### 1. 系统依赖安装

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip python3-venv nginx

# CentOS/RHEL
sudo yum install -y nodejs npm python3 python3-pip nginx

# macOS
brew install node python@3.11 nginx
```

#### 2. 应用部署

```bash
# 克隆项目
git clone <your-repository-url>
cd listening-training-app

# 安装依赖
npm install

# 设置环境变量
cp .env.production.example .env.production
# 编辑 .env.production 文件

# 初始化 Kokoro TTS
npm run setup-kokoro

# 初始化数据库
chmod +x scripts/init-db.sh
./scripts/init-db.sh

# 创建管理员账户
npm run seed:users

# 构建应用
npm run build

# 启动应用
npm start
```

#### 3. 进程管理（PM2）

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'listening-training-app',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

## 环境变量配置

### 必需变量

```bash
# AI 服务
CEREBRAS_API_KEY=your_cerebras_api_key_here

# JWT 认证
JWT_SECRET=your-strong-jwt-secret-here

# 数据库
DATABASE_URL=file:./data/app.db

# TTS 配置
PYTORCH_ENABLE_MPS_FALLBACK=1

# 应用端口
PORT=3000
```

### 可选变量

```bash
# 管理员账户
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=StrongPassword123!
ADMIN_NAME=System Administrator

# 代理配置（如需要）
PROXY_URL=http://your-proxy:8080

# 日志级别
LOG_LEVEL=info

# 数据库备份
BACKUP_RETENTION_DAYS=7
BACKUP_PATH=/backups
```

## Nginx 配置

### 基础配置

```nginx
# 参考 nginx/nginx.conf.example 文件
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 数据库管理

### 初始化

```bash
# 运行初始化脚本
chmod +x scripts/init-db.sh
./scripts/init-db.sh

# 创建管理员账户
npm run seed:users
```

### 备份

```bash
# 手动备份
chmod +x scripts/backup.sh
./scripts/backup.sh

# 自动备份（添加到 crontab）
0 2 * * * /path/to/app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### 恢复

```bash
# 从备份恢复
chmod +x scripts/restore.sh
./scripts/restore.sh /path/to/backup/file.tar.gz
```

## 监控和日志

### 应用日志

```bash
# 实时查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看性能日志
tail -f logs/performance.log
```

### 健康检查

```bash
# 运行健康检查
chmod +x scripts/health-check.sh
./scripts/health-check.sh

# 设置定期检查（添加到 crontab）
*/5 * * * * /path/to/app/scripts/health-check.sh >> /var/log/health-check.log 2>&1
```

### 性能监控

访问以下端点获取系统状态：

- `GET /api/health` - 应用健康状态
- `GET /api/performance/metrics` - 性能指标
- `GET /admin` - 管理面板（需要管理员权限）

## 故障排查

### 常见问题

#### 1. Kokoro TTS 初始化失败

```bash
# 症状：TTS 服务无法启动
# 解决方案：
cd kokoro-local
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 验证 Python 版本
python --version  # 必须是 3.8-3.12
```

#### 2. AI 服务连接失败

```bash
# 检查 API 密钥
echo $CEREBRAS_API_KEY

# 测试网络连接
curl -H "Authorization: Bearer $CEREBRAS_API_KEY" \
     https://api.cerebras.ai/v1/models

# 如需代理，在 lib/ark-helper.ts 中配置 PROXY_URL
```

#### 3. 数据库连接问题

```bash
# 检查数据库文件权限
ls -la data/app.db

# 重新初始化数据库
rm data/app.db
npm run db:push

# 创建管理员账户
npm run seed:users
```

#### 4. 内存不足

```bash
# 检查内存使用
free -h

# 检查应用进程
ps aux | grep node

# 重启应用释放内存
pm2 restart listening-training-app
```

#### 5. 端口占用

```bash
# 检查端口占用
lsof -i :3000

# 查找并终止进程
kill -9 <PID>
```

### 日志分析

```bash
# 查看错误趋势
grep "ERROR" logs/app.log | tail -50

# 分析性能问题
grep "SLOW_QUERY" logs/performance.log

# 检查 TTS 服务状态
grep "TTS" logs/app.log | tail -20
```

## 性能优化

### 1. 系统调优

```bash
# 增加文件描述符限制
echo "* soft nofile 65535" >> /etc/security/limits.conf
echo "* hard nofile 65535" >> /etc/security/limits.conf

# 优化内核参数
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf
sysctl -p
```

### 2. 数据库优化

```bash
# SQLite 性能调优
sqlite3 data/app.db << EOF
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
EOF
```

### 3. 缓存配置

在 Nginx 中配置静态文件缓存：

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 安全配置

### 1. 防火墙设置

```bash
# Ubuntu/Debian
ufw enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# CentOS/RHEL
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### 2. SSL/TLS 配置

```bash
# 生成强随机 JWT 密钥
openssl rand -hex 32

# 设置文件权限
chmod 600 .env.production
chmod 700 data/
chmod 600 data/app.db
```

### 3. 定期更新

```bash
# 设置自动安全更新
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
```

## 自动化部署

使用提供的部署脚本：

```bash
# 初始部署
chmod +x scripts/deploy.sh
./scripts/deploy.sh --init

# 更新部署
./scripts/deploy.sh --update

# 回滚部署
./scripts/deploy.sh --rollback
```

## 维护任务

### 定期任务

```bash
# 添加到 crontab
crontab -e

# 添加以下任务：
# 每日凌晨 2 点备份数据库
0 2 * * * /path/to/app/scripts/backup.sh

# 每 5 分钟健康检查
*/5 * * * * /path/to/app/scripts/health-check.sh

# 每周日清理旧音频文件
0 3 * * 0 find /path/to/app/public/audio -name "*.wav" -mtime +7 -delete

# 每月清理旧日志
0 4 1 * * find /path/to/app/logs -name "*.log" -mtime +30 -delete
```

## 扩展和集群部署

### 负载均衡配置

```nginx
upstream app_cluster {
    server 127.0.0.1:3000 weight=1;
    server 127.0.0.1:3001 weight=1;
    server 127.0.0.1:3002 weight=1;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://app_cluster;
        # ... 其他配置
    }
}
```

### 数据库集群（可选）

如需高可用性，可考虑：
- PostgreSQL 主从复制
- MySQL Galera 集群
- Redis 缓存层

## 支持和联系

如遇到部署问题，请：

1. 查看 `logs/` 目录下的日志文件
2. 运行 `scripts/health-check.sh` 诊断系统状态
3. 检查环境变量配置是否正确
4. 确认系统要求是否满足

**重要提醒**：
- 定期备份数据库和用户数据
- 保持系统和依赖项更新
- 监控系统资源使用情况
- 设置告警机制用于生产环境监控