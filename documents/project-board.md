# 工作流与功能看板

## To-Do
- [ ] 编写并验证 `.github/workflows/prewarm-deps.yml`（参见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。
- [ ] 将 Dockerfile 基础镜像替换为 GHCR 镜像并测试缓存命中（参见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。
- [ ] 设计 `kokoro_local/selftest` CLI 脚本与配置范本（参见 `documents/future-roadmap/tts-refactor-roadmap.md`）。

## In Progress
- [ ] 阶段 2：实现 CLI 自检脚本（待执行）

## Review
- [ ] （留空，提交 PR 后填入）

## Done
- [x] 2025-10-06 **阶段 1：抽离 Kokoro 文本分块模块并统一 wrapper 入口**
  - 创建 `kokoro-local/text_chunker.py`
  - 重构 `kokoro_wrapper.py` 使用新模块
  - 强化离线加载逻辑（环境变量 `KOKORO_LOCAL_MODEL_PATH`）
  - 迁移历史脚本到 `legacy/` 目录
  - 更新 `lib/kokoro-env.ts` 引用新 wrapper
  - 验证：Python 语法 ✅、Node 层引用 ✅、lint/test 通过 ✅
- [x] 2025-10-06 清理冗余文档：删除根目录 8 个历史总结文件，删除 documents/ 目录 25 个历史文件，保留核心文档结构（状态、看板、快照、路线图）。
