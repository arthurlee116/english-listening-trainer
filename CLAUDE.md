# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Reminder: Whenever you add a new text document, place it in the repository's `documents/` directory.

## 项目概述

这是一个基于 Next.js 15 的英语听力训练应用，使用 AI 生成内容和本地 Kokoro TTS 引擎。主要特点：
- 邮箱密码用户认证系统（JWT会话管理）
- Cerebras AI 驱动的内容生成
- 本地 Kokoro TTS（支持 Apple Silicon Metal 加速）  
- SQLite/Prisma 数据持久化
- TypeScript 全栈开发

## 开发环境设置

### 前置要求
- Node.js 18+
- Python 3.8-3.12（Kokoro TTS 不支持 Python 3.13+）
- macOS（推荐，支持 Apple Silicon）
- npm 包管理器（推荐）：`npm install -g npm`

### 必需环境变量
```bash
# .env.local 
CEREBRAS_API_KEY=your_api_key_here
PYTORCH_ENABLE_MPS_FALLBACK=1
JWT_SECRET=your-jwt-secret-here
DATABASE_URL=file:./data/app.db
# 可选的管理员账号配置
ADMIN_EMAIL=admin@listeningtrain.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator
CEREBRAS_PROXY_URL=
```

### 初始化和启动命令
```bash
npm install                    # 安装依赖
npm run setup-kokoro          # 初始化 Kokoro TTS 环境
npm exec tsx scripts/seed-user-db.ts  # 用户数据库初始化（创建管理员账号）
npm run dev                   # 启动开发服务器
```

### 构建和部署命令
```bash
npm run build                 # 生产构建
npm run start                 # 启动生产服务器  
npm run lint                  # 代码检查
```

### 管理功能
```bash
npm run admin                 # 启动管理服务器（端口3005）
npm run admin-dev            # 开发模式管理服务器
```

## 核心架构

### 用户认证系统
- **验证流程**: `app/api/auth/` 路由处理注册、登录、登出
- **JWT 会话**: httpOnly cookies 存储JWT token，支持"记住我"功能
- **密码要求**: 最少8位，包含大写字母、小写字母、数字
- **管理**: `/admin` 路径提供用户管理界面（仅管理员可访问）
- **性能提示**: `hooks/use-auth-state.ts` 在客户端缓存用户信息，并依赖 `lib/database.ts` 中的 WAL/busy_timeout 初始化来加速 `/api/auth/me`；如调整任一侧需同步更新

### AI 内容生成流程
1. **话题生成**: `POST /api/ai/topics` - 基于难度和时长生成话题建议
2. **文稿生成**: `POST /api/ai/transcript` - 生成符合 CEFR 级别的听力材料
3. **问题生成**: `POST /api/ai/questions` - 生成单选题和简答题
4. **答案评分**: `POST /api/ai/grade` - AI 自动评分和反馈

### 本地 TTS 架构
- **Node.js 桥接**: `lib/kokoro-service.ts` - KokoroTTSService 类管理 Python 进程（CPU 版本）
- **GPU 服务**: `lib/kokoro-service-gpu.ts` - GPU 版本带有断路器、指数退避和自动重启
- **Python 包装器**: `kokoro-local/kokoro_wrapper.py` - Kokoro TTS 模型封装
- **GPU 包装器**: `kokoro-local/kokoro_wrapper_real.py` - 通过 soundfile 写 WAV，避免 SciPy 依赖（需确认 libsndfile 就绪）
- **语音映射**: `lib/language-config.ts` - 与 GPU 服务共用的语言→语音配置，确保生成语音一致
- **分块策略**: CPU/GPU 包装器统一按 100 字符拆分长文本，绕开 Kokoro 的序列长度限制
- **Metal/CUDA 加速**: 自动检测 Apple Silicon 或 CUDA 环境并开启加速
- **音频存储与清理**: 生成的 WAV 文件保存在 `public/`；`lib/audio-cleanup-service.ts` 由 `lib/kokoro-init.ts` 自动启动，定期清理过期或超量文件
- **接口契约**: `/api/tts` 返回 `success/audioUrl/duration/byteLength/provider`，前端播放器通过 `initialDuration` 即时渲染进度信息

### 数据库设计
- **users**: 用户信息和认证数据
- **practice_sessions**: 练习记录存储（关联到用户）

## 关键文件和目录

### 前端组件
- `app/page.tsx` - 主应用流程和状态管理
- `components/audio-player.tsx` - 音频播放控件（可调速）
- `components/question-interface.tsx` - 问答界面
- `components/auth-dialog.tsx` - 登录/注册对话框

### 后端服务
- `app/api/ai/*` - Cerebras AI 服务接口
- `app/api/auth/*` - 用户认证 API 路由
- `app/api/admin/*` - 管理员功能 API 路由
- `app/api/tts/route.ts` - 本地 TTS 服务接口
- `lib/auth.ts` - JWT认证和用户管理工具
- `lib/database.ts` - SQLite 数据库操作
- `lib/ai-service.ts` - AI 服务客户端封装

### TTS 系统
- `kokoro-local/` - 本地 TTS 环境
- `scripts/setup-kokoro.sh` - TTS 环境自动化设置脚本
- `kokoro-main-ref/` - Kokoro 源码参考

## 开发注意事项

### 代理配置
- Cerebras API 调用在开发时默认使用 `http://127.0.0.1:7890`，生产环境默认 `http://81.71.93.183:10811`
- 通过设置 `CEREBRAS_PROXY_URL` 可覆盖默认代理，逻辑位于 `lib/ark-helper.ts`

### 构建配置
- TypeScript 和 ESLint 错误在构建时被忽略（`next.config.mjs`）
- 图片优化已禁用以提高兼容性

### TTS 性能优化
- 首次加载需要 3-5 秒（模型初始化）
- 音频生成时间：2-8 秒（取决于文本长度）
- 内存占用：约 1-2GB（PyTorch 模型）

### 数据库管理
- 开发时可删除 `data/app.db` 重新初始化
- 生产环境需要考虑备份机制

## 测试和调试

### 本地测试
1. 确保 Kokoro TTS 环境已正确设置
2. 验证 Cerebras API 密钥配置
3. 检查 SQLite 数据库文件权限
4. 运行 `npm exec tsx scripts/seed-user-db.ts` 创建管理员账号
5. 使用创建的管理员账号或注册新账号进行功能验证
6. 保持质量检查：`npm run lint`、`npm test -- --run`

### 常见问题
- **Python 版本问题**: 验证 Python 版本 (`python3 --version`)，需要 3.8-3.12
- **TTS 初始化失败**: 重新运行 `npm run setup-kokoro`
- **虚拟环境重建**: `cd kokoro-local && rm -rf venv && python3.12 -m venv venv`
- **AI 生成失败**: 检查 API 密钥和网络连接
- **用户认证失败**: 检查 JWT_SECRET 环境变量配置
- **管理员账号问题**: 运行 `npm exec tsx scripts/seed-user-db.ts` 重新创建
- **数据库架构问题**: 删除 `data/app.db` 并运行数据库初始化脚本重新创建

## 生产部署考虑

- 确保 JWT_SECRET 使用强随机值
- 修改默认管理员账号密码（通过环境变量）
- 实施适当的错误处理和日志记录
- 考虑音频文件的清理策略
- 设置数据库备份机制
- 配置 HTTPS 确保 JWT cookies 安全传输

## 系统重构记录 (2024-12)
**重构类型**: 用户系统架构完全重写
**改动范围**: 从邀请码访问控制系统改为标准的邮箱密码认证系统

### 主要变更:
1. **数据库架构**: 从8个邀请码相关表简化为2个用户认证相关表
2. **认证方式**: 移除邀请码验证，改为JWT会话管理的邮箱密码认证
3. **前端组件**: 重写认证界面，从邀请码输入改为登录/注册表单
4. **管理界面**: 从邀请码管理改为用户管理和系统统计
5. **API架构**: 新增完整的用户认证API路由集合

### 技术特点:
- bcryptjs 密码哈希加密
- JWT token 无过期时间支持"记住我"功能
- httpOnly cookies 安全存储
- 密码复杂度验证（8+字符，大小写+数字）
- 管理员权限控制

## 部署和运维脚本

### 自动化脚本
- `scripts/backup.sh` - 数据库和音频文件备份
- `scripts/restore.sh` - 从备份恢复数据
- `scripts/health-check.sh` - 系统健康监控
- `scripts/deploy.sh` - 自动化部署（初始/更新/回滚）
- `scripts/init-db.sh` - 数据库初始化和用户创建

### Docker 部署
- `docker-compose.production.yml` - 生产环境容器化部署
- `nginx/nginx.conf.example` - Nginx 反向代理配置模板
- `.env.production.example` - 生产环境配置模板

### 监控和维护
- `/api/health` - 健康检查端点
- `/api/performance/metrics` - 性能指标
- `/admin` - 管理面板（需要管理员权限）

## 最近更新记录

### 2025-08-29: PostgreSQL 迁移工具集
**改进内容**: 完整的数据库迁移方案和自动化工具  
- **新增迁移脚本** (`scripts/migrate-to-postgres.ts`)
  - 从邀请码系统迁移到用户认证系统
  - 自动创建用户账号（基于邀请码）和转换练习记录
  - 数据验证和回滚功能，支持 `--verify-only` 和 `--rollback` 参数
- **数据库切换工具** (`scripts/switch-database.sh`)
  - SQLite/PostgreSQL 快速切换命令
  - 自动更新 Prisma Schema 和环境配置
  - 数据库状态检查和连接验证
- **详细迁移指南** (`scripts/MIGRATION-GUIDE.md`)
  - 完整迁移步骤说明和环境配置
  - 故障排除方案和回滚计划
  - 用户账号信息和数据映射规则
- **支持的数据库命令**:
  - `npm run migrate-data` - 执行完整迁移
  - `npm run migrate-data:verify` - 仅验证数据一致性  
  - `npm run migrate-data:rollback` - 清空目标数据库
  - `./scripts/switch-database.sh [sqlite|postgres|status]` - 快速切换数据库
  - `./scripts/dev-db.sh [start|stop|reset]` - PostgreSQL 容器管理
  - `./scripts/dev-db-fallback.sh` - 本地 PostgreSQL 备用方案（当Docker有问题时）

**备注**: 工具已完成测试，支持完整的架构升级迁移。**Docker 启动问题已修复**，同时提供本地 PostgreSQL 备用方案。

## 系统默认账号信息

### 管理员账号（固定）
- **邮箱**：admin@listeningtrain.com
- **密码**：Admin123456  
- **权限**：系统管理员，可访问管理界面 `/admin`
- **说明**：此为系统固定管理员账号，用于所有开发和测试环境

### 测试用户账号
- **邮箱**：test@example.com
- **密码**：Test123456
- **权限**：普通用户
- **说明**：标准测试用户账号，用于验证普通用户功能

## 重要提醒
- 如果你根据我的要求改进了代码，请务必在本文件中添加注释，并说明你的改进内容
- 除非我明确要求，否则你不允许使用模拟数据来代替真实的AI服务输出
- 如果我刚刚让你生成的某一个功能的代码出现了问题，你不应该回退到前一个版本的功能，而应该是把现在的代码修好
- 你的计划只要获得我的允许，就可以放开手脚去做，可以无限制的使用工具，可以无限制的输出，直到达到我的要求为止
- 每次做更改以后（更改完成确认可以运行，功能正常以后）进行git commit
- 每次git commit后，都必须push到github
- 严禁使用任何的模拟数据或者硬编码的测试数据

## 最重要的规则
- 以暗猜接口为耻，以认真查阅为荣。
- 以模糊执行为耻，以寻求确认为荣。
- 以盲想业务为耻，以人类确认为荣。
- 以创造接口为耻，以复用现有为荣。
- 以跳过验证为耻，以主动测试为荣。
- 以破坏架构为耻，以遵循规范为荣。
- 以假装理解为耻，以诚实无知为荣。
- 以盲目修改为耻，以谨慎重构为荣。
