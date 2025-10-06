# 项目状态总表

> 最近更新：2025-10-06。更新本文件时同步调整此处日期。

## 当前核心目标
- [x] 切换 Docker 基础镜像与缓存分层（详见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。负责人：待指定。目标日期：待定。
- [ ] 重构 Kokoro TTS 模块并落地自检 CLI（详见 `documents/future-roadmap/tts-refactor-roadmap.md`）。负责人：待指定。进度：阶段 1 已完成（4 阶段中）。

## 最近里程碑
- 2025-10-06 **代码重构：使用 kokoro-env 辅助函数消除硬编码路径**
  - 重构 Node.js 层所有 TTS 服务使用 `lib/kokoro-env.ts` 辅助函数
  - 消除硬编码路径，提供单一数据源
  - 支持环境变量覆盖、自动 venv 检测、跨平台兼容性
  - 修改文件：
    - `lib/kokoro-service-enhanced.ts` - 使用辅助函数进行路径解析
    - `lib/enhanced-tts-service.ts` - 使用辅助函数进行路径解析
    - `lib/config-manager.ts` - 使用辅助函数设置默认值
    - `app/api/health/route.ts` - 使用辅助函数进行路径检查
  - 验证：ESLint 通过 ✅
- 2025-10-06 **完成阶段 1：Kokoro wrapper 重构与离线加载强化**
  - 创建 `kokoro_local/text_chunker.py` 独立分块模块
  - 重构 `kokoro_wrapper.py` 使用新分块模块
  - 强化离线加载逻辑，添加 `KOKORO_LOCAL_MODEL_PATH` 环境变量支持
  - 迁移 3 个历史脚本到 `kokoro_local/legacy/` 并标记 deprecated
  - 更新 `lib/kokoro-env.ts` 引用新 wrapper 路径
- 2025-10-06 清理冗余文档，删除 33 个历史总结文件，保留核心文档结构。
- 2025-03-?? 新增《AI 协作守则》与 CI/TTS 路线图（`documents/future-roadmap/`）。

## 阻塞/待确认事项
- [ ] 远程部署机 Docker 层缓存是否保留完好？（检查 `docker images --digests` 结果并记录于快照）

## 下一步计划
- 本周：完成 TTS 重构阶段 2（CLI 自检脚本实现）。
- 下周：完成 TTS 重构阶段 3（GitHub Actions 集成）与阶段 4（文档同步）。

## 参考文档
- CI 缓存路线图：`documents/future-roadmap/ci-docker-cache-roadmap.md`
- TTS 重构路线图：`documents/future-roadmap/tts-refactor-roadmap.md`
- 协作守则：`documents/future-roadmap/ai-collaboration-guidelines.md`
