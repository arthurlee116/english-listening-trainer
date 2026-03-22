# Vercel Deployment Runbook (Authoritative)

这份文档描述当前的真实生产部署方式：Vercel + Postgres + Blob + GitHub Actions 定时刷新。

## 1. 当前生产拓扑

- 应用平台：Vercel
- 数据库：Neon / Vercel Postgres 风格的托管 Postgres
- 音频存储：Vercel Blob
- 定时任务：GitHub Actions 调用 Vercel cron route
- 文本生成：Cerebras
- TTS：Together

## 2. 关键环境变量

Vercel 项目至少需要这些变量：

### 数据库

- `DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### 鉴权 / 应用

- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`

### AI / TTS

- `CEREBRAS_API_KEY`
- `CEREBRAS_BASE_URL`
- `AI_TIMEOUT`
- `AI_MAX_RETRIES`
- `AI_DEFAULT_MODEL`
- `AI_DEFAULT_TEMPERATURE`
- `TOGETHER_API_KEY`
- `TOGETHER_BASE_URL`
- `TOGETHER_TTS_MODEL`
- `TTS_TIMEOUT`
- `TTS_MAX_CONCURRENT`
- `TTS_QUEUE_LIMIT`
- `ENABLE_TTS`
- `EXA_API_KEY`

可选代理变量：

- `CEREBRAS_PROXY_URL`
- `TOGETHER_PROXY_URL`
- `RSS_PROXY_URL`
- `PROXY_URL`
- `HTTPS_PROXY`
- `HTTP_PROXY`

### Blob / Cron

- `BLOB_READ_WRITE_TOKEN`
- `CRON_SECRET`

## 3. 构建与 schema 同步

Vercel 使用：

- `vercel.json` 中的 `buildCommand: npm run vercel-build`

`vercel-build` 会执行：

1. `npm run db:sync`
2. `npm run build`

`db:sync` 依赖 `POSTGRES_URL_NON_POOLING` / `DIRECT_URL` / `DATABASE_URL` 中至少一个。

## 4. 健康检查

- `GET /api/health`
  - 公共、快速
  - 用于部署成功后的 readiness 检查
- `GET /api/health?mode=deep`
  - 管理员专用
  - 用于人工诊断

## 5. 新闻刷新

### 自动刷新

`.github/workflows/refresh-news.yml` 每 6 小时执行一次：

```bash
curl -H "Authorization: Bearer ${VERCEL_CRON_SECRET}" \
  "${VERCEL_PRODUCTION_URL}/api/cron/refresh-news"
```

GitHub 侧需要：

- repo secret: `VERCEL_CRON_SECRET`
- repo variable: `VERCEL_PRODUCTION_URL`

### 手动刷新

```bash
npm run refresh-news
```

或直接调用：

```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  https://<your-production-domain>/api/cron/refresh-news
```

## 6. Vercel CLI 部署

### Preview

```bash
vercel deploy -y
```

### Production

```bash
vercel deploy --prod -y
```

## 7. 上线后验证

### 探活

```bash
curl --connect-timeout 5 --max-time 15 -fsS https://<your-production-domain>/api/health
```

### AI 主题生成

```bash
curl --connect-timeout 5 --max-time 30 -fsS \
  -X POST https://<your-production-domain>/api/ai/topics \
  -H 'content-type: application/json' \
  -d '{"difficulty":"A2","wordCount":120,"language":"en-US"}'
```

### TTS

```bash
curl --connect-timeout 5 --max-time 120 -fsS \
  -X POST https://<your-production-domain>/api/tts \
  -H 'content-type: application/json' \
  -d '{"text":"Hello from deployment verification.","language":"en-US","speed":1.0}'
```

### 评估音频

```bash
curl --connect-timeout 5 --max-time 30 -fsS https://<your-production-domain>/api/assessment-audio/1
```

## 8. 已知平台差异

- 不能再依赖本地 SQLite 文件
- 不能再依赖运行时写 `public/audio` / `public/assessment-audio`
- 不能再用进程内 `node-cron`
- 不能再假设存在本机 ffmpeg 可执行文件

现在这几件事都已经分别迁到：

- Postgres
- Blob
- GitHub Actions / Vercel-friendly cron route
- Together 直接返回 WAV，再由 Blob 持久化
