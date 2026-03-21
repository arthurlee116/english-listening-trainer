# English Listening Trainer

AI 驱动的英语听力训练站点。核心链路是：

1. 用户登录后选择难度、时长、语言和主题
2. Cerebras 生成 transcript 和题目
3. Together TTS 生成音频并通过 `/api/audio/*` 提供流式播放
4. 用户答题、评分、查看结果、保存历史
5. 可选使用新闻推荐、错题 AI 分析、管理员后台和听力自评

这不是离线 Kokoro 本地站，也不是生产 PostgreSQL 项目。真实现状是：

- 文本生成：Cerebras
- TTS：Together `hexgrad/Kokoro-82M`
- 生产数据库：SQLite
- 新闻刷新：外部定时任务触发，不在应用进程内自动跑

## 现在有哪些功能

- AI 生成听力主题、稿子、题目、评分
- 多语言听力练习：`en-US`、`en-GB`、`es`、`fr`、`ja`、`it`、`pt-BR`、`hi`
- 用户登录、历史记录、错题本、AI 错题分析
- 新闻推荐话题和预生成新闻 transcript
- 管理后台与效果统计
- 听力自评（注意：这是用户自评分，不是客观考试）

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Prisma 7 + `better-sqlite3`
- Tailwind CSS + Radix UI
- Vitest + Testing Library + Playwright

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local`，至少配置这些：

```env
DATABASE_URL=file:./data/app.db
JWT_SECRET=replace-me

CEREBRAS_API_KEY=your-cerebras-key
CEREBRAS_BASE_URL=https://api.cerebras.ai
AI_DEFAULT_MODEL=gpt-oss-120b

TOGETHER_API_KEY=your-together-key
TOGETHER_BASE_URL=https://api.together.xyz/v1
TOGETHER_TTS_MODEL=hexgrad/Kokoro-82M

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

如果你的网络环境需要代理：

```env
CEREBRAS_PROXY_URL=http://127.0.0.1:10808
TOGETHER_PROXY_URL=http://127.0.0.1:10808
RSS_USE_SYSTEM_PROXY=true
```

### 3. 初始化数据库

```bash
npm run db:sync
```

`db:sync` 会统一做 SQLite 路径规范化、目录创建、预建 DB 文件和 `prisma db push`。测试和生产也走同一个入口。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`。

## 常用命令

```bash
npm run dev
npm run build
npm run start

npm run lint
npm run test:run
npm run test:e2e

npm run db:generate
npm run db:sync
npm run db:studio

npm run refresh-news
```

## 新闻推荐怎么刷新

新闻数据不会因为访问接口、启动应用或构建项目而自动刷新。

- 手动刷新：`npm run refresh-news`
- 生产自动刷新：GitHub Actions 工作流 `Refresh News Topics`

这样做是为了避免 build/runtime 副作用，把刷新行为收敛到可控入口。

## 健康检查

- `GET /api/health`
  - 公共、快速、用于部署探活
  - 只检查应用进程信息和数据库 readiness
- `GET /api/health?mode=deep`
  - 仅管理员可用
  - 返回数据库、TTS 探针、代理状态、目录状态、内存等诊断信息

## 测试说明

- `npm run lint`
- `npm run test:run`
- `npm run build`

仓库里的集成测试会使用临时 SQLite 路径，并通过 `db:sync` 初始化，不再直接裸跑 Prisma 命令。

默认不会跑真实外部服务测试；要跑真实 Cerebras / Together 验证，请设置：

```bash
RUN_REAL_SERVICES=true
```

## 部署

生产部署以 [DEPLOYMENT.md](./DEPLOYMENT.md) 为准。那里才是权威文档，包含：

- VPS / 域名 / Docker / Caddy 拓扑
- 生产环境变量和 SQLite 挂载方式
- deploy workflow 与手动部署步骤
- 新闻定时刷新方式
- 线上验证命令

## 目前有意保留的边界

- 听力自评是“用户自评分映射难度”，不是标准化考试
- 自动难度是本地个性化状态，不是跨设备统一画像
- 这次仓库清理只覆盖核心问题链路，不做全仓重构
