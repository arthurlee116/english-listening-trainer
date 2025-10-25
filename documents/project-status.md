# 项目状态总览

### 当前版本
- **版本号**: v1.3.1
- **最后更新**: 2025-10-19
- **状态**: 稳定版本，生产就绪

### 核心功能状态
- ✅ **TTS模块重构**: Kokoro本地TTS集成完成，支持GPU加速
- ✅ **用户认证系统**: JWT认证，支持注册/登录/权限管理
- ✅ **AI分析服务**: Cerebras API集成，支持结构化生成、标签覆盖率评估与自动降级
- ✅ **多语言支持**: 中英文双语界面
- ✅ **数据库迁移**: Prisma ORM，支持SQLite/PostgreSQL
- ✅ **CI/CD流水线**: GitHub Actions，自动构建和部署
- ✅ **Docker容器化**: 多阶段构建，GPU支持
- ✅ **缓存优化**: 多级Docker缓存，部署速度提升90%
- ✅ **远程部署指南**: 完整的部署文档和最佳实践

### 技术栈
- **前端**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes, Prisma ORM
- **数据库**: SQLite (开发), PostgreSQL (生产)
- **TTS**: Kokoro (本地), OpenAI (备用)
- **AI服务**: Cerebras API
- **容器化**: Docker, Docker Compose
- **部署**: GitHub Actions, GHCR
- **监控**: 健康检查, 日志管理

### 最近更新

### 2025-10-25
- 🔧 修复ESLint警告：移除未使用的类型导入和变量声明
  - 清理 `app/page.tsx` 中未使用的 `GradingResult`、`WrongAnswerItem` 类型导入
  - 移除未使用的 `setLanguage`、`safeLocalStorageGet`、`safeLocalStorageSet` 变量
  - 清理 `components/history-panel.tsx` 中未使用的 `Target` 图标导入
  - 移除 `components/results-display.tsx` 中未使用的 `FocusArea` 类型导入

## 最近更新
- 2025-10-25 **优化专项练习模式清理**
  - 完全删除 `components/results-display.tsx` 中160行的专项练习统计Card(之前仅用false隐藏)
  - 移除未使用的imports: Target, TrendingUp, TrendingDown, Minus, AlertTriangle, FocusAreaStats
  - 将 ResultsDisplayProps 中的 focusAreaStats 和 onRetryWithAdjustedTags 标记为 never 类型(已废弃但保留以兼容历史代码)
  - 保留题目的 focus_areas 属性显示(用于错题分析和标签统计)
  - 验证所有exercise.focusAreas引用都有可选链保护,避免运行时错误
  - 构建验证通过,无TypeScript错误
- 2025-10-25 **移除专项练习模式**
  - 删除 `lib/specialized-preset-storage.ts`、`lib/focus-metrics.ts`、`lib/focus-metrics-cache.ts` 专项模式服务文件
  - 从 `app/page.tsx` 移除专项模式状态、hooks、事件处理函数和API调用中的focusAreas参数
  - 简化 `hooks/use-practice-setup.ts`,移除专项模式参数和语言切换回调
  - 从 `components/home/practice-configuration.tsx` 移除专项练习UI组件和相关接口
  - 隐藏 `components/history-panel.tsx` 和 `components/results-display.tsx` 中的专项模式显示区块
  - 跳过 `tests/e2e/scenarios/complete-user-journey.spec.tsx` 中的专项练习测试
  - 更新 `tests/fixtures/exercises/sample-exercises.ts`,将helper函数标记为已废弃
  - API保持向后兼容: `/api/practice/save` 保留可选的focusAreas/focusCoverage参数以兼容历史数据
  - 保留Focus Area类型定义供其他功能使用,翻译文件保持完整以免破坏历史数据展示
  - 构建验证通过,无TypeScript类型错误
- 2025-10-25 **彻底移除快捷键功能**
  - 删除 `lib/shortcuts.ts`、`hooks/use-hotkeys.ts`、`components/shortcut-help-dialog.tsx` 快捷键相关文件
  - 从 `app/page.tsx` 移除快捷键导入、状态、处理函数和 UI 组件（包括 Keyboard 图标和快捷键按钮）
  - 从 `lib/i18n/translations/common.json` 和 `components.json` 移除所有 `shortcuts.*` 相关翻译键
  - 删除 `tests/unit/hooks/use-hotkeys.test.ts` 测试文件
  - 清理 localStorage 中 `english-listening-shortcuts-*` 相关存储键的使用
  - 构建检查通过，无 TypeScript 类型错误和未使用引用警告
  - 界面仅保留点击/触控交互，不再显示任何快捷键相关提示
- 2025-10-25 **下线练习模板系统**
  - 删除 `hooks/use-practice-templates.ts` 和 `lib/template-storage.ts` 模板存储模块
  - 从 `app/page.tsx` 移除模板相关的 hook 调用和状态管理
  - 从 `components/home/practice-configuration.tsx` 移除模板卡片 UI、保存/应用/重命名/删除功能
  - 从 `lib/types.ts` 删除 `PracticeTemplate` 接口定义
  - 从 `lib/i18n/translations/pages.json` 清理模板相关翻译键
  - 删除 `tests/unit/hooks/use-practice-templates.test.ts` 测试文件
  - 在应用初始化时自动清空 `localStorage` 中的 `english-listening-templates` 键，确保无残留数据
  - 核心练习流程（配置、话题生成、音频生成、题目答题）在无模板功能下保持完整可用
- 2025-10-25 **按钮文案与宣传语更新**
  - 将“评估”按钮改为“自测英文水平”，英文 "Assessment" → "Test My Level"
  - 将“历史”按钮改为“练习历史”，英文 "History" → "Practice History"
  - 将“生成话题建议”改为“生成话题”，英文 "Generate Topic Suggestions" → "Generate Topics"
  - 更新宣传语为轻松语气：中文“轻松练听力，让 AI 帮你进步更有趣”，英文 "Make learning fun with bite-sized AI listening practice"
  - 同步更新 `lib/i18n/translations/common.json`、`pages.json`、`app/page.tsx`、`app/layout.tsx`、`README.md`
- 2025-10-25 **话题建议区新增「换一批」按钮**
  - 在 `lib/i18n/translations/common.json` 中添加 `buttons.refreshTopics` 翻译文案
  - 修改 `app/api/ai/topics/route.ts` 支持 `excludedTopics` 参数，避免生成重复话题
  - 更新 `lib/ai/prompt-templates.ts` 在提示词中排除已有话题
  - 扩展 `lib/ai-service.ts` 的 `generateTopics` 函数支持传递排除列表
  - 在 `app/page.tsx` 中实现 `handleRefreshTopics` 函数并传递给组件
  - 在 `components/home/practice-configuration.tsx` 中添加「换一批」按钮 UI，仅在有话题时显示
- 2025-10-19 **注册后自动登录优化**
  - 修改 `app/api/auth/register/route.ts` 注册成功后生成 JWT token 并设置 auth-token cookie
  - 更新 `components/auth-dialog.tsx` 注册成功后直接调用 `onUserAuthenticated` 实现自动登录，无需手动切换到登录页

### 近期产品迭代（按难度递增且无前置依赖）
1. ~~话题建议区新增「换一批」按钮与加载态，避免生成重复主题~~ ✅  
2. ~~重写指定按钮与宣传语文案，保持中英文同步更新~~ ✅  
3. ~~下线练习模板系统并清理本地缓存数据~~ ✅  
4. ~~彻底移除快捷键功能及相关配置、翻译与测试~~ ✅  
5. 下线专项练习模式并清理成就/历史展示依赖  
6. 建立数据库驱动的语言切换体系，实现按用户偏好单语展示  
7. 改造首页为可折叠左侧导航布局，强化导航体验
- 2025-10-19 **注册后自动登录优化**
  - 修改 `app/api/auth/register/route.ts` 注册成功后生成 JWT token 并设置 auth-token cookie
  - 更新 `components/auth-dialog.tsx` 注册成功后直接调用 `onUserAuthenticated` 实现自动登录，无需手动切换到登录页
- 2025-10-18 **主页练习流模块化与音频控制解耦**
  - `app/page.tsx` 精简为容器组件，引入 `components/home/practice-configuration.tsx`、`practice-workspace.tsx`、`authentication-gate.tsx` 管理练习配置与认证
  - 新增 `hooks/use-practice-setup.ts`、`hooks/use-practice-templates.ts` 统一练习模板与专项模式状态，并补充 Vitest 单元测试
  - 替换旧版播放器为 `components/audio-player/AudioPlayer.tsx` + `hooks/use-audio-player.ts`，拓展播放控制 API 与测试覆盖
- 2025-10-18 **GPU TTS 单栈切换与音频流式化**
  - 删除 `lib/kokoro-service.ts` 并将 `app/api/tts/route.ts`、`app/api/tts/route-optimized.ts` 统一改用 `kokoroTTSGPU`，同步刷新 `README.md`、`CLAUDE.md`
  - `app/api/audio/[filename]/route.ts` 重写 Range 解析、安全校验与流式输出，统一响应头字段并给出 416 兜底
  - 新增 `tests/integration/api/audio-route.spec.ts` 覆盖整段、区间、后缀与不可满足 Range，验证播放器兼容性
- 2025-10-16 **音频播放与分块体验优化**
  - `app/api/audio/[filename]/route.ts` 增加 HTTP Range 支持，拖拽进度条时播放器可立即续播
  - `lib/audio-utils.ts` 修复大于 10MB WAV 的 chunk 解析，准确回传持续时间与采样信息
  - `kokoro_local/text_chunker.py` 优化长文本分块，优先按单词切分并对极端长词安全回退
- 2025-10-15 **AI 调用层统一、结构化输出与代理容错强化**
  - 创建 `lib/ark-helper.ts`、`lib/ai/cerebras-client-manager.ts`、`lib/ai/telemetry.ts`，集中处理 Cerebras/Ark 调用、代理可用性探活、调用遥测与回退链路
  - 新增 `lib/ai/request-preprocessor.ts`、`lib/ai/retry-strategy.ts`、`lib/ai/prompt-templates.ts`、`lib/ai/schemas.ts`、`lib/ai/transcript-expansion.ts`，实现难度/语言预处理、指数退避重试、统一 Prompt 模板与 JSON Schema 解析
  - `/api/ai/topics|questions|transcript|grade|expand` 全面迁移至 `invokeStructured()` 管道，内置限流熔断、焦点标签覆盖率评估、扩写回退与降级日志
  - `lib/monitoring.ts` 接入最新 AI 遥测与 Cerebras 健康检查快照，`lib/config-manager.ts` 支持 `AI_DEFAULT_MAX_TOKENS` 等配置
- 2025-10-13 **Scripts 目录精简**
  - 删除历史远程部署脚本，保留 `backup.sh`、`restore.sh`、`setup-kokoro.sh`
  - 更新 `package.json`、Docker Compose、部署文档改用手动命令
  - 清理文档引用，避免误用内嵌凭据
- 2025-10-12 **Phase 4: 远程服务器缓存预热完成**
  - 创建 `scripts/remote-cache-prewarm.sh` 和 `scripts/verify-cache-layers.sh`（已于 2025-10-13 归档），实现多级缓存预热与完整性校验
  - 更新 `scripts/deploy-from-ghcr.sh`（已于 2025-10-13 归档）将缓存预热纳入标准部署流程，并统一 `Dockerfile.optimized` 的 `NODE_MAJOR=20`
  - 在 `documents/workflow-snapshots/remote-cache-prewarm-snapshot.md` 记录执行细节与问题排查日志
  - （2025-10-13 更新：上述脚本已归档，改用 GHCR + docker compose 手动命令）
- 2025-10-07 **Phase 4: 完善部署文档与缓存管理指南**
  - 新增《CACHE_MANAGEMENT_GUIDE.md》《SERVER_DEPLOYMENT_TEST_GUIDE.md》《WORKFLOW_TESTING_GUIDE.md》三份文档，覆盖缓存刷新策略、部署排查以及 workflow 验证流程
  - 同步状态表、看板、快照与路线图，标记 CI 缓存优化路线图收官

## 当前核心目标
- [x] CI/Docker 缓存优化（详见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。负责人：Claude。进度：Phase 4 已完成 ✅
- [x] 重构 Kokoro TTS 模块并落地自检 CLI（详见 `documents/future-roadmap/tts-refactor-roadmap.md`）。负责人：待指定。进度：全部 4 阶段已完成 ✅

## 最近里程碑
- 2025-10-12 **Phase 4: 远程服务器缓存预热完成**
  - 创建 `scripts/remote-cache-prewarm.sh` 与 `scripts/verify-cache-layers.sh`（2025-10-13 起归档），并在 `deploy-from-ghcr.sh` 集成缓存预热流程
  - 统一 Dockerfile 说明与 NODE_MAJOR 版本，补充远程服务器部署手册（`documents/DEPLOYMENT.md`）
  - （2025-10-13 更新：脚本工具已退役，部署手册改为纯命令行流程）
- 2025-10-07 **Phase 4: 缓存与部署文档完善**
  - 发布《CACHE_MANAGEMENT_GUIDE.md》《SERVER_DEPLOYMENT_TEST_GUIDE.md》《WORKFLOW_TESTING_GUIDE.md》
  - 更新状态/看板/快照/路线图，完成 CI 缓存优化收尾工作
- 2025-10-07 **Phase 3: 主构建工作流切换至多级缓存链**
  - 更新 `.github/workflows/build-and-push.yml` 使用 GHCR `cache-base/cache-python/cache-node/cache-builder` 链
  - 移除 `actions/cache` 与本地目录迁移逻辑，新增 4GB 磁盘阈值检查与缓存命中统计
- 2025-10-07 **Phase 2: 依赖缓存预热工作流完成**
  - 创建 `.github/workflows/prewarm-deps.yml`（三层缓存：base → python → node），滚动+季度标签策略
  - 每周一 02:00 UTC 自动执行，手动触发时提醒刷新依赖层
- 2025-10-07 **Phase 1: 基础镜像内刊化（含 cuDNN8 标签修复）**
  - 推送 CUDA 基础镜像至 GHCR（`12.1.1-cudnn8-runtime-ubuntu22.04`，digest `sha256:b2c52e...c12faa34`）
  - 验证 cuDNN 版本，更新 Dockerfile 引用，并配置远程服务器镜像加速器
- 2025-10-06 **关键 Bug 修复：PR #6-9 推送**
  - 修复 `kokoro_wrapper.py` 环境变量空字符串路径问题，重命名 `kokoro-local/` → `kokoro_local/`
  - 补充 ImportError 捕获，避免 CI 依赖缺失导致的自检失败，并同步 30+ 文件路径
- 2025-10-06 **阶段 4：最终文档同步**
  - 更新 `CLAUDE.md` 与相关 TTS 文档，补充 CLI 自检命令示例和生产验证步骤
- 2025-10-06 **阶段 3：GitHub Actions 集成自检步骤**
  - 在 `.github/workflows/build-and-push.yml` 添加 Kokoro 自检任务，上传 JSON 报告 artifact
- 2025-10-06 **阶段 2：CLI 自检脚本实现**
  - 创建 `kokoro_local/selftest/` 模块与 CPU/GPU 配置，支持 Markdown/JSON 输出与性能指标
- 2025-10-06 **阶段 1：Kokoro wrapper 重构与离线加载强化**
  - 创建 `kokoro_local/text_chunker.py`，强化 `KOKORO_LOCAL_MODEL_PATH` 处理，迁移 legacy 脚本
- 2025-10-06 **文档清理**
  - 删除 33 个历史总结文件，保留状态、看板、快照与路线图核心文档

## 阻塞/待确认事项
- [ ] 每季度初检查远程部署机缓存是否仍命中（参考《SERVER_DEPLOYMENT_TEST_GUIDE.md》）

### 已知问题
- ⚠️ **GPU内存管理**: 长时间运行可能出现内存泄漏，需要定期重启
- ⚠️ **音频文件清理**: 需要实现自动清理机制，避免磁盘空间不足
- ⚠️ **并发限制**: TTS服务并发处理能力有限，需要优化队列机制
- ⚠️ **Kokoro Pascal GPU支持**: 由于部署优先，暂未集成自编译的 sm_61 PyTorch 方案；Tesla P40 环境仍依赖官方二进制包并会打印 GRU/weight_norm 警告。待部署完成后再评估安全的解决路径（记录于 2025-10-13）。

### 性能指标
- **部署时间**: 从3-4GB减少到<300MB（缓存优化后）
- **启动时间**: 容器启动 < 60秒
- **TTS响应**: 本地Kokoro < 2秒，GPU加速 < 0.5秒
- **API响应**: 平均 < 500ms
- **内存使用**: 稳定运行 < 1GB

### 下一步计划
- 🔄 **性能监控**: 集成Prometheus + Grafana监控
- 🔄 **自动扩缩容**: 基于负载的容器自动扩缩容
- 🔄 **安全加固**: SSL证书，API限流，输入验证
- 🔄 **测试覆盖**: 增加单元测试和集成测试覆盖率
- 🔄 **文档完善**: API文档，用户手册，开发者指南

### 部署信息
- **生产环境**: http://49.234.30.246:3000
- **管理后台**: http://49.234.30.246:3005
- **镜像仓库**: ghcr.io/arthurlee116/english-listening-trainer
- **文档地址**: `documents/DEPLOYMENT.md`

### 团队联系
- **技术负责人**: arthurlee116
- **运维支持**: ubuntu@49.234.30.246
- **问题反馈**: GitHub Issues

---

*最后更新: 2025-10-19 10:25 UTC*
