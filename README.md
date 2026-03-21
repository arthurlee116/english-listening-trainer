# English Listening Trainer

一个部署在 Vercel 上的 AI 英语听力训练站。当前架构已经从“VPS + SQLite + 本地文件落盘”迁到“Vercel + Postgres + Blob + 外部定时任务”。

## 现在的真实架构

- 前端 / 全栈框架：Next.js 16 + React 19
- 数据库：Postgres（Vercel 项目已接 Neon / Vercel Postgres 风格环境变量）
- ORM：Prisma 7
- 文本生成：Cerebras
- TTS：Together `hexgrad/Kokoro-82M`
- 音频持久化：Vercel Blob
- 定时刷新新闻：GitHub Actions 定时命中 `/api/cron/refresh-news`

## 用户侧功能

- 账号登录 / 注册
- AI 生成听力主题、听力稿、题目、评分
- TTS 音频播放
- 历史记录、错题本、AI 错题分析
- 新闻推荐话题与预生成新闻稿
- 管理后台
- 听力自评（注意：这是自评分映射，不是标准化考试）

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`，填入至少这些值：

```env
DATABASE_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...   # 可选，运行时优先
POSTGRES_URL_NON_POOLING=postgresql://... # Prisma CLI / schema sync 用

JWT_SECRET=replace-me

CEREBRAS_API_KEY=...
CEREBRAS_BASE_URL=https://api.cerebras.ai
AI_DEFAULT_MODEL=gpt-oss-120b

TOGETHER_API_KEY=...
TOGETHER_BASE_URL=https://api.together.xyz/v1
TOGETHER_TTS_MODEL=hexgrad/Kokoro-82M

EXA_API_KEY=...
BLOB_READ_WRITE_TOKEN=...

CRON_SECRET=replace-me
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 同步数据库 schema

```bash
npm run db:sync
```

它会走 `scripts/sync-db.mjs`，统一执行 Prisma schema push。

### 4. 启动开发服务器

```bash
npm run dev
```

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm run test:run

npm run db:generate
npm run db:sync
npm run db:studio

npm run refresh-news
```

## 健康检查

- `GET /api/health`
  - 公共、快速，用于部署探活
  - 只看应用进程信息和数据库 readiness
- `GET /api/health?mode=deep`
  - 需要管理员身份
  - 返回数据库、TTS、代理、目录、内存等诊断信息

## 定时刷新新闻

当前不在应用进程内跑 cron。自动刷新来源是：

- `.github/workflows/refresh-news.yml`

工作流会带 `Authorization: Bearer $VERCEL_CRON_SECRET` 调用：

- `/api/cron/refresh-news`

## 部署

这个项目现在用 Vercel CLI / Vercel Project 部署。权威部署文档看 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 这次迁移的边界

- 用户侧功能尽量保持不变，但底层存储/部署方式已经彻底改成云平台友好的实现
- 历史和错题逻辑仍然可用
- 自动难度依旧是本地个性化状态，不是跨设备统一画像
