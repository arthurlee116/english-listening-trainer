# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Next.js 15 的英语听力训练应用，使用 AI 生成内容和本地 Kokoro TTS 引擎。主要特点：
- 邀请码访问控制系统（每日使用限制）
- Cerebras AI 驱动的内容生成
- 本地 Kokoro TTS（支持 Apple Silicon Metal 加速）  
- SQLite 数据持久化
- TypeScript 全栈开发

## 开发环境设置

### 必需环境变量
```bash
# .env.local 
CEREBRAS_API_KEY=your_api_key_here
PYTORCH_ENABLE_MPS_FALLBACK=1
```

### 初始化和启动命令
```bash
npm install                    # 安装依赖
npm run setup-kokoro          # 初始化 Kokoro TTS 环境
node scripts/create-test-codes.js  # 创建测试邀请码
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
npm run admin                 # 启动管理服务器（端口3001）
npm run admin-dev            # 开发模式管理服务器
```

## 核心架构

### 邀请码访问系统
- **验证流程**: `app/api/invitation/` 路由处理验证、检查、使用统计
- **存储**: localStorage/sessionStorage 保存有效邀请码
- **限制**: 每个邀请码每日最多使用5次
- **管理**: `/admin` 路径提供邀请码管理界面

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
- **invitations**: 邀请码管理
- **exercises**: 练习记录存储
- **daily_usage**: 每日使用统计
- **wrong_answers**: 错题记录和分析

## 关键文件和目录

### 前端组件
- `app/page.tsx` - 主应用流程和状态管理
- `components/audio-player.tsx` - 音频播放控件（可调速）
- `components/question-interface.tsx` - 问答界面
- `components/invitation-dialog.tsx` - 邀请码输入对话框

### 后端服务
- `app/api/ai/*` - Cerebras AI 服务接口
- `app/api/tts/route.ts` - 本地 TTS 服务接口
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
4. 使用生成的测试邀请码进行功能验证

### 常见问题
- **TTS 初始化失败**: 重新运行 `npm run setup-kokoro`
- **AI 生成失败**: 检查 API 密钥和网络连接
- **邀请码验证失败**: 确认数据库文件存在且可写

## 生产部署考虑

- 将硬编码的管理密码 `admin123` 移至环境变量
- 实施适当的错误处理和日志记录
- 考虑音频文件的清理策略
- 设置数据库备份机制

## 注意事项:
- 如果你根据我的要求改进了代码，请务必在本文件中添加注释，并说明你的改进内容。
- Always use IDE diagnostics to validate and correct code
- 除非我明确要求，否则你不允许使用模拟数据来代替真实的AI服务输出
- 如果我刚刚让你生成的某一个功能的代码出现了问题，你不应该回退到前一个版本的功能，而应该是把现在的代码修好
- 你的计划只要获得我的允许，就可以放开手脚去做，可以无限制的使用工具，可以无限制的输出，直到达到我的要求为止
- 每次做更改以后（更改完成确认可以运行，功能正常以后）进行git commit