# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Next.js 15 的英语听力训练应用，使用 AI 生成内容和本地 Kokoro TTS 引擎。主要特点：
- 邮箱密码用户认证系统（JWT会话管理）
- Cerebras AI 驱动的内容生成
- 本地 Kokoro TTS（支持 Apple Silicon Metal 加速）  
- SQLite 数据持久化
- TypeScript 全栈开发

## 开发环境设置

### 前置要求
- Node.js 18+
- Python 3.8-3.12（Kokoro TTS 不支持 Python 3.13+）
- macOS（推荐，支持 Apple Silicon）
- pnpm 包管理器（推荐）：`npm install -g pnpm`

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
```

### 初始化和启动命令
```bash
npm install                    # 安装依赖（推荐使用 pnpm install）
npm run setup-kokoro          # 初始化 Kokoro TTS 环境
pnpm exec tsx scripts/seed-user-db.ts  # 用户数据库初始化（创建管理员账号）
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

### AI 内容生成流程
1. **话题生成**: `POST /api/ai/topics` - 基于难度和时长生成话题建议
2. **文稿生成**: `POST /api/ai/transcript` - 生成符合 CEFR 级别的听力材料
3. **问题生成**: `POST /api/ai/questions` - 生成单选题和简答题
4. **答案评分**: `POST /api/ai/grade` - AI 自动评分和反馈

### 本地 TTS 架构
- **Node.js 桥接**: `lib/kokoro-service.ts` - KokoroTTSService 类管理 Python 进程
- **Python 包装器**: `kokoro-local/kokoro_wrapper.py` - Kokoro TTS 模型封装
- **Metal 加速**: 自动检测 Apple Silicon 并启用 MPS 加速
- **音频存储**: 生成的 WAV 文件保存在 `public/audio/`

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
- `lib/db.ts` - SQLite 数据库操作
- `lib/ai-service.ts` - AI 服务客户端封装

### TTS 系统
- `kokoro-local/` - 本地 TTS 环境
- `scripts/setup-kokoro.sh` - TTS 环境自动化设置脚本
- `kokoro-main-ref/` - Kokoro 源码参考

## 开发注意事项

### 代理配置
如需代理访问 Cerebras API，在 `lib/ark-helper.ts` 中配置 `PROXY_URL`

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
4. 运行 `pnpm exec tsx scripts/seed-user-db.ts` 创建管理员账号
5. 使用创建的管理员账号或注册新账号进行功能验证

### 常见问题
- **Python 版本问题**: 验证 Python 版本 (`python3 --version`)，需要 3.8-3.12
- **TTS 初始化失败**: 重新运行 `npm run setup-kokoro`
- **虚拟环境重建**: `cd kokoro-local && rm -rf venv && python3.12 -m venv venv`
- **AI 生成失败**: 检查 API 密钥和网络连接
- **用户认证失败**: 检查 JWT_SECRET 环境变量配置
- **管理员账号问题**: 运行 `pnpm exec tsx scripts/seed-user-db.ts` 重新创建
- **数据库架构问题**: 删除 `data/app.db` 并运行数据库初始化脚本重新创建

## 生产部署考虑

- 确保 JWT_SECRET 使用强随机值
- 修改默认管理员账号密码（通过环境变量）
- 实施适当的错误处理和日志记录
- 考虑音频文件的清理策略
- 设置数据库备份机制
- 配置 HTTPS 确保 JWT cookies 安全传输

## 注意事项:
- 如果你根据我的要求改进了代码，请务必在本文件中添加注释，并说明你的改进内容。
- Always use IDE diagnostics to validate and correct code
- 除非我明确要求，否则你不允许使用模拟数据来代替真实的AI服务输出
- 如果我刚刚让你生成的某一个功能的代码出现了问题，你不应该回退到前一个版本的功能，而应该是把现在的代码修好
- 你的计划只要获得我的允许，就可以放开手脚去做，可以无限制的使用工具，可以无限制的输出，直到达到我的要求为止
- 每次做更改以后（更改完成确认可以运行，功能正常以后）进行git commit

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