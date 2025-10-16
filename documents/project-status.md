# 项目状态总览

### 当前版本
- **版本号**: v1.3.0
- **最后更新**: 2025-10-12
- **状态**: 稳定版本，生产就绪

### 核心功能状态
- ✅ **TTS模块重构**: Kokoro本地TTS集成完成，支持GPU加速
- ✅ **用户认证系统**: JWT认证，支持注册/登录/权限管理
- ✅ **AI分析服务**: Cerebras API集成，支持文本分析和评估
- ✅ **多语言支持**: 中英文双语界面
- ✅ **数据库迁移**: Prisma ORM，支持SQLite/PostgreSQL
- ✅ **CI/CD流水线**: GitHub Actions，自动构建和部署
- ✅ **Docker容器化**: 多阶段构建，GPU支持
- ✅ **缓存优化**: 多级Docker缓存，部署速度提升90%
- ✅ **远程部署指南**: 完整的部署文档和最佳实践

### 技术栈
- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes, Prisma ORM
- **数据库**: SQLite (开发), PostgreSQL (生产)
- **TTS**: Kokoro (本地), OpenAI (备用)
- **AI服务**: Cerebras API
- **容器化**: Docker, Docker Compose
- **部署**: GitHub Actions, GHCR
- **监控**: 健康检查, 日志管理

### 最近更新
- 2025-10-15 **AI 调用层统一与探活强化**
  - 新增 `lib/ai/cerebras-service.ts` 与 `lib/ai/route-utils.ts`，统一 Cerebras 结构化调用、限流与熔断封装
  - `/api/ai/topics|questions|transcript|grade|expand` 全面迁移至 `invokeStructured<T>()`，复用集中式 JSON Schema
  - `lib/monitoring.ts` 接入 Cerebras 实际健康探活，`/api/health` 返回代理状态与延迟信息
  - 配置中心新增 `AI_PROXY_URL`、`AI_ENABLE_PROXY_HEALTH_CHECK`，支持按环境切换代理与探活策略
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

*最后更新: 2025-10-12 10:34 UTC*
