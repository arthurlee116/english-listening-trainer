# 项目状态总表

> 最近更新：2025-10-06。更新本文件时同步调整此处日期。

## 当前核心目标
- [x] 切换 Docker 基础镜像与缓存分层（详见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。负责人：待指定。目标日期：待定。
- [ ] 重构 Kokoro TTS 模块并落地自检 CLI（详见 `documents/future-roadmap/tts-refactor-roadmap.md`）。负责人：待指定。进度：阶段 1 已完成（4 阶段中）。

## 最近里程碑
- 2025-10-06 **路径不一致修复：Node.js 层同步 kokoro_local 目录命名**
  - **问题**：PR #6-8 将 Python 层目录从 `kokoro-local/` 重命名为 `kokoro_local/`，但 Node.js 服务层仍硬编码旧路径
  - **影响**：TTS 服务初始化失败，因 wrapper 文件路径无法找到（ENOENT 错误）
  - **修复范围**：更新 5 个关键文件共 11 处硬编码路径
    - `lib/kokoro-service-enhanced.ts:126,135,152`
    - `lib/enhanced-tts-service.ts:269,289,290,301`
    - `lib/config-manager.ts:140,141`
    - `app/api/health/route.ts:50`
    - `vitest.config.ts:58`
  - 验证：ESLint 通过 ✅（无新增错误）
- 2025-10-06 **关键 Bug 修复：PR #6-9 bug 修复推送**
  - **Bug #1**：修复环境变量空字符串导致 `Path('')` 解析为当前目录问题（`kokoro_wrapper.py:122-140`）
  - **Bug #2**：重命名 `kokoro-local/` → `kokoro_local/`，解决 Python 模块命名冲突（30+ 文件更新）
  - **Bug #3**：修复 CI 环境缺少 torch/soundfile 导致 selftest 失败问题（添加 ImportError 捕获）
  - 受影响 PR：#6 (7542a2d), #7 (9ecacec), #8 (a431f15), #9 (e2a9c5d)
  - 详细记录：`documents/workflow-snapshots/tts-selftest-snapshot.md`
- 2025-10-06 **完成阶段 4：最终文档同步**
  - 更新 `CLAUDE.md` 添加 Kokoro CLI 使用说明
  - 添加 CLI 自检命令示例（CPU/GPU/CI 模式）
  - 更新 Python 集成章节，说明新模块结构
  - 添加 `KOKORO_LOCAL_MODEL_PATH` 环境变量文档
  - 补充生产环境 TTS 验证步骤
- 2025-10-06 **完成阶段 3：GitHub Actions 集成自检步骤**
  - 修改 `.github/workflows/build-and-push.yml` 添加 Kokoro 自检步骤
  - 集成 Python 3.11 环境配置与 PyYAML 依赖安装
  - 使用 `--skip-on-missing-model` 参数确保 CI 环境兼容性
  - 实现 JSON 格式测试报告生成与上传（artifact 保留 30 天）
  - 添加测试结果到 GitHub Actions Summary
  - 验证：YAML 语法检查通过 ✅
- 2025-10-06 **完成阶段 2：CLI 自检脚本实现**
  - 创建 `kokoro_local/selftest/` 模块（`__init__.py`, `__main__.py`）
  - 创建配置文件 `configs/default.yaml`（CPU）和 `configs/gpu.yaml`（GPU）
  - 实现 Markdown 输出格式（默认）与 JSON 输出格式
  - 支持 `--skip-on-missing-model` 参数用于 CI 环境
  - 集成 `KOKORO_LOCAL_MODEL_PATH` 环境变量
  - 输出性能指标：合成时间、音频时长、实时因子、chunks 数量
- 2025-10-06 **完成阶段 1：Kokoro wrapper 重构与离线加载强化**
  - 创建 `kokoro-local/text_chunker.py` 独立分块模块
  - 重构 `kokoro_wrapper.py` 使用新分块模块
  - 强化离线加载逻辑，添加 `KOKORO_LOCAL_MODEL_PATH` 环境变量支持
  - 迁移 3 个历史脚本到 `kokoro-local/legacy/` 并标记 deprecated
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
