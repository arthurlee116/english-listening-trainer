# AI Deployment Runbook (Authoritative)

这份文档是这个仓库的生产部署单一事实来源。别拿 README 猜，按这里来。

## 0. 安全规则

- 不要提交或粘贴真实密钥、`.env.production`、SSH 私钥、代理订阅链接、管理员密码
- 可以记录服务器 IP / 域名 / 路径
- 需要真实值时，从服务器读取或问人

## 1. 生产现状

### 服务器

- 提供商/区域：Tencent Cloud, Hong Kong
- 公网 IP：`43.159.200.246`
- SSH 用户：`ubuntu`
- 项目目录：`/srv/leesaitool/english-listening-trainer`

### 域名与反代

- 站点域名：`listen.leesaitool.com`
- Caddy 路径：`/etc/caddy/Caddyfile`
- Caddy 负责 TLS，并把流量按 Host 转发到本机容器

### 应用运行方式

- 部署方式：GitHub Actions 推送 `main` 自动部署，或手动 SSH 部署
- Compose 文件：`/srv/leesaitool/english-listening-trainer/docker-compose.prod.yml`
- 容器内部端口：`3000`
- 宿主机映射：`127.0.0.1:3001 -> 3000`

### 数据库

- 生产数据库：SQLite
- 宿主机文件：`/srv/leesaitool/english-listening-trainer/prisma/data/app.db`
- 容器路径：`/app/prisma/data/app.db`
- 生产必须设置：

```env
DATABASE_URL=file:/app/prisma/data/app.db
```

### AI / TTS / 代理

- 文本生成：Cerebras
- TTS：Together `hexgrad/Kokoro-82M`
- 如生产环境需要代理，应用容器通过宿主机代理栈访问外部服务：

```env
CEREBRAS_PROXY_URL=http://172.19.0.1:10808
TOGETHER_PROXY_URL=http://172.19.0.1:10808
```

代理私密配置在服务器 `/srv/leesaitool/proxy/`，不要写进仓库。

## 2. 当前部署契约

### 启动顺序

容器启动时执行：

1. `npm run db:sync`
2. `npm run start`

`db:sync` 会统一做：

- SQLite URL 规范化
- 目录创建
- 预建 DB 文件
- `prisma db push --accept-data-loss`

数据库同步失败时，容器必须直接失败，不能吞错后继续跑应用。

### 健康检查

- 默认探活：`GET /api/health`
  - 公共、快速
  - 只检查进程信息和数据库 readiness
  - 这是部署 workflow 唯一使用的健康检查
- 深度诊断：`GET /api/health?mode=deep`
  - 仅管理员可用
  - 额外包含 TTS 探针、代理状态、目录状态、内存等信息

### 新闻刷新

应用进程内**不会**自动刷新新闻。

自动刷新来源只有一个：

- GitHub Actions 工作流：`Refresh News Topics`

工作流会 SSH 到服务器，并在运行中的应用容器里执行：

```bash
npm run refresh-news
```

## 3. 已知坑

### Cerebras Base URL

`CEREBRAS_BASE_URL` 必须是：

```env
https://api.cerebras.ai
```

不要带 `/v1`。SDK 自己会拼。

### Prisma 7

`schema.prisma` 里不要写 `datasource.url`，连接串由 `prisma.config.ts` 提供。

### SQLite 数据持久化

数据库必须挂载宿主机目录，别把 DB 留在容器文件系统里。

### 健康检查别做深检

默认 `/api/health` 是 readiness，不应该跑慢探针。深度探针只能放在 `?mode=deep`。

### 新闻刷新不能绑在 import / build 上

任何请求、构建、冷启动都不应该隐式触发刷新；自动刷新只能来自外部调度。

## 4. 生产文件与目录

需要存在这些持久化目录：

```bash
mkdir -p public/audio public/assessment-audio data logs prisma/data
```

生产 Compose 挂载：

- `./prisma/data:/app/prisma/data`
- `./public/audio:/app/public/audio`
- `./public/assessment-audio:/app/public/assessment-audio`
- `./data:/app/data`
- `./logs:/app/logs`

## 5. 日常部署

### GitHub Actions 自动部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`：

1. SSH 到服务器
2. `git fetch --all && git reset --hard origin/main`
3. `docker compose ... up -d --build app`
4. 用带超时的 `curl` 检查 `https://listen.leesaitool.com/api/health`

### 手动部署

```bash
# 1. 同步代码
ssh ubuntu@43.159.200.246 \
  'cd /srv/leesaitool/english-listening-trainer && git fetch --all && git reset --hard origin/main'

# 2. 重建并启动
ssh ubuntu@43.159.200.246 \
  'cd /srv/leesaitool/english-listening-trainer && sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build app'

# 3. 探活
curl --connect-timeout 5 --max-time 15 -fsS https://listen.leesaitool.com/api/health
```

如果你改了环境变量：

```bash
ssh ubuntu@43.159.200.246 \
  'cd /srv/leesaitool/english-listening-trainer && sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate --no-deps app'
```

## 6. 新闻刷新

### 手动刷新

```bash
ssh ubuntu@43.159.200.246 \
  'cd /srv/leesaitool/english-listening-trainer && sudo docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app npm run refresh-news'
```

### 自动刷新

- 工作流：`.github/workflows/refresh-news.yml`
- 频率：每 6 小时一次
- 也支持 `workflow_dispatch`

## 7. 线上验证清单

### 基础探活

```bash
curl --connect-timeout 5 --max-time 15 -fsS https://listen.leesaitool.com/api/health
```

### 深度诊断

管理员登录后：

```bash
curl --connect-timeout 5 --max-time 20 -fsS \
  --cookie "auth-token=<admin-cookie>" \
  'https://listen.leesaitool.com/api/health?mode=deep'
```

### AI 主题生成

```bash
curl --connect-timeout 5 --max-time 30 -fsS \
  -X POST https://listen.leesaitool.com/api/ai/topics \
  -H 'content-type: application/json' \
  -d '{"difficulty":"A2","wordCount":120,"language":"en-US"}'
```

### TTS

```bash
curl --connect-timeout 5 --max-time 120 -fsS \
  -X POST https://listen.leesaitool.com/api/tts \
  -H 'content-type: application/json' \
  -d '{"text":"Hello, this is a deployment test.","language":"en-US","speed":1.0}'
```

### 评估音频

```bash
curl --connect-timeout 5 --max-time 30 -fsS https://listen.leesaitool.com/api/assessment-audio/1
```

## 8. 出问题时怎么查

### 容器日志

```bash
ssh ubuntu@43.159.200.246 \
  'sudo docker logs --tail=200 english-listening-trainer-app-1'
```

### 看容器环境变量

```bash
ssh ubuntu@43.159.200.246 \
  'sudo docker inspect english-listening-trainer-app-1 --format "{{range .Config.Env}}{{println .}}{{end}}"'
```

### 验证容器内数据库路径

```bash
ssh ubuntu@43.159.200.246 \
  'cd /srv/leesaitool/english-listening-trainer && sudo docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app sh -lc "echo \$DATABASE_URL && ls -lah /app/prisma/data"'
```

## 9. 仍未解决的外部问题

如果代码已经更新，但 `https://listen.leesaitool.com` 依然超时：

- 先确认 `127.0.0.1:3001` 上应用存活
- 再检查 Caddy / TLS / Host 路由
- 这已经不是应用代码问题，是反代链路问题
