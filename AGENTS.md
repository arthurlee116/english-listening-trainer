# AGENTS.md

为在本仓库中工作的智能编码代理提供一份精炼、可执行的项目说明与操作手册。内容基于现有代码与 CLAUDE.md 中的信息整理，旨在帮助你快速搭建环境、运行、修改与验证功能。

## 项目概述
- 技术栈：Next.js 15、TypeScript、Prisma、SQLite、Kokoro 本地 TTS、Cerebras AI 内容生成
- 功能域：邮箱密码认证（JWT 会话、httpOnly cookies）、AI 生成听力材料与题目、TTS 生成音频、练习记录存储、管理员面板
- 运行平台：推荐 macOS（Apple Silicon 可启用 Metal/MPS 加速）

## 前置依赖
- Node.js >= 18
- Python 3.8–3.12（Kokoro TTS 不支持 3.13+）
- 推荐包管理器：pnpm（npm 亦可）

## 环境变量
在项目根目录创建 .env.local（或 .env）并设置：
```
# .env.local
CEREBRAS_API_KEY=your_api_key_here
PYTORCH_ENABLE_MPS_FALLBACK=1
JWT_SECRET=your-jwt-secret-here
DATABASE_URL=file:./data/app.db
# 可选管理员账号（用于初始化）
ADMIN_EMAIL=admin@listeningtrain.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator
```

## 常用命令速查
- 安装依赖：npm install
- 初始化 Kokoro TTS：npm run setup-kokoro
- 初始化管理员账号：npm run seed-user-db
- 启动开发：npm run dev（Next.js 开发服务器）
- 构建生产：npm run build
- 启动生产：npm run start
- 代码检查：npm run lint
- 管理后台（3005）：npm run admin（或 npm run admin-dev）

package.json 中可用脚本（节选）：
- dev、build、start、lint
- admin、admin-dev
- prisma 相关：db:generate、db:migrate、db:deploy、db:studio、db:push、db:reset
- TTS 相关：setup-kokoro

## 架构与核心流程
- 认证系统
  - 路由：app/api/auth/*
  - 会话：JWT 存于 httpOnly cookie；支持“记住我”
  - 密码规范：>= 8 字符，包含大小写与数字
  - 管理端：/admin（仅管理员）
- AI 内容生成
  - POST /api/ai/topics：按难度与时长生成话题
  - POST /api/ai/transcript：生成听力材料（符合 CEFR）
  - POST /api/ai/questions：生成题目（单选/简答）
  - POST /api/ai/grade：自动评分与反馈
- 本地 TTS
  - Node 桥接：lib/kokoro-service.ts（管理 Python 进程）
  - Python 包装：kokoro-local/kokoro_wrapper.py
  - 加速：Apple Silicon 自动启用 MPS/Metal（PYTORCH_ENABLE_MPS_FALLBACK=1）
  - 输出：音频文件存放于 public/audio/
- 数据库
  - Prisma + SQLite，DATABASE_URL 默认 file:./data/app.db
  - 主要表：users、practice_sessions

## 重要目录与文件
- 前端入口与 UI
  - app/page.tsx（主流程与状态）
  - components/audio-player.tsx（可变速播放）
  - components/auth-dialog.tsx（登录/注册）
- 服务端与 API
  - app/api/ai/*（Cerebras AI 接口）
  - app/api/auth/*（认证）
  - app/api/admin/*（管理员功能）
  - app/api/tts/route.ts（本地 TTS）
  - lib/auth.ts（JWT/用户工具）
  - lib/database.ts（SQLite 封装）
  - lib/ai-service.ts（AI 客户端）
- TTS 环境与脚本
  - kokoro-local/（本地 TTS 环境）
  - scripts/setup-kokoro.sh（自动化安装）
- 运维与部署
  - docker-compose.yml（容器化示例）
  - nginx/nginx.conf.example（反向代理模板）
  - .env.production.example（生产配置模板）

## 开发与构建注意
- 若需代理 Cerebras API，可在 lib/ark-helper.ts 配置 PROXY_URL
- 构建容错：next.config.mjs 对 TS/ESLint 报错容忍度较高（忽略严格失败，便于迭代）
- TTS 首次加载 3–5s；生成音频约 2–8s；内存占用约 1–2GB

## 校验与联调建议（无正式测试框架）
- 运行 npm run lint 保持类型与 Lint 清洁
- 本地核验清单：
  1) Kokoro TTS 初始化成功（scripts/setup-kokoro.sh）
  2) CEREBRAS_API_KEY 生效
  3) SQLite 文件与目录权限可写
  4) 管理员账号可用（执行 seed 脚本）
  5) 访问 /api/health、/api/performance/metrics、/admin 验证核心链路

## 安全与合规
- 严禁提交任何真实密钥与凭据（使用 .env* 文件与本地环境变量）
- JWT_SECRET 必须使用高强度随机值
- 生产启用 HTTPS 以保护 cookies 传输安全
- 考虑音频与数据库备份/清理策略

## 故障排查（常见问题）
- Python 版本：必须 3.8–3.12（python3 --version）
- TTS 初始化失败：重跑 npm run setup-kokoro
- 虚拟环境异常：删除并重建 venv（例如 python3.12 -m venv venv）
- AI 生成失败：检查 API Key 与网络/代理
- 认证异常：检查 JWT_SECRET、数据库可写性
- 架构不一致：删除 data/app.db 后重新初始化

## 部署与运维
- 优先使用 docker-compose.yml + Nginx 模板示例
- 监控端点：/api/health（健康检查）、/api/performance/metrics（性能指标）
- 管理面板：/admin（仅管理员）

## 面向智能代理的工作准则
- 若你对代码进行了改进，请在 CLAUDE.md、AGENTS.md 与相关代码处添加注释，说明改动与原因
- 除非我明确要求，禁止用模拟数据代替真实 AI 服务输出（可通过 feature flag 或兜底分支隔离）
- 若新代码存在问题，请修复当前实现，不要回退到旧版本功能
- 每次完成可运行的改动后进行小步提交（信息清晰、范围单一）

## 变更范围建议（Pull Request 提示）
- 标题格式建议：[area] 一句话说明
- 在提交前：确保能本地启动、核心 API 可用、lint 通过
- 如涉及行为变更，请补充代码注释与必要的内嵌说明，便于后续代理理解

——
本文件旨在让各类编码代理在本仓库有清晰、统一的操作与约定。若项目结构或脚本有更新，请同步维护此文件。