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
- [x] 2025-10-06 **路径不一致修复：Node.js 层同步 kokoro_local 目录命名**
  - 修复 PR #6-8 遗留问题：Node.js 服务文件仍使用旧路径 `kokoro-local`
  - 更新 5 个关键文件的硬编码路径：
    - `lib/kokoro-service-enhanced.ts`（3 处）
    - `lib/enhanced-tts-service.ts`（4 处）
    - `lib/config-manager.ts`（2 处）
    - `app/api/health/route.ts`（1 处）
    - `vitest.config.ts`（1 处 coverage 排除配置）
  - 所有路径从 `kokoro-local` 更新为 `kokoro_local`
  - 验证：ESLint 通过 ✅（无新增错误）
- [x] 2025-10-06 **关键 Bug 修复：PR #6-9**
  - 修复环境变量空字符串路径错误（`kokoro_wrapper.py:122-140`）
  - 重命名 `kokoro-local/` → `kokoro_local/`（Python 模块兼容性）
  - 修复 CI 依赖缺失问题（添加 ImportError 捕获，`selftest/__main__.py:56-68`）
  - 更新所有路径引用（30+ 文件，包括 TypeScript、YAML、Markdown）
  - 推送修复到 PR #6 (7542a2d), #7 (9ecacec), #8 (a431f15), #9 (e2a9c5d)
- [x] 2025-10-06 **阶段 4：最终文档同步**
  - 更新 `CLAUDE.md` 添加 Kokoro CLI 使用说明
  - 添加 TTS Setup 部分的 CLI 自检命令示例
  - 更新 Python Integration 章节说明新模块结构
  - 添加 `KOKORO_LOCAL_MODEL_PATH` 环境变量文档
  - 补充生产环境 TTS 验证步骤
  - 验证：文档一致性 ✅
- [x] 2025-10-06 **阶段 3：GitHub Actions 集成自检步骤**
  - 修改 `.github/workflows/build-and-push.yml` 添加 Kokoro 自检步骤
  - 添加 Python 3.11 环境配置（使用 actions/setup-python@v5）
  - 安装 PyYAML 依赖
  - 运行 `python -m kokoro_local.selftest --config configs/default.yaml --format json --skip-on-missing-model`
  - 上传测试报告为 artifact（保留 30 天）
  - 添加测试结果到 GitHub Actions Summary
  - 验证：YAML 语法 ✅
- [x] 2025-10-06 **阶段 2：实现 CLI 自检脚本**
  - 创建 `kokoro_local/selftest/` 模块结构
  - 创建配置文件 `configs/default.yaml`（CPU）和 `configs/gpu.yaml`（GPU）
  - 实现 `selftest/__main__.py` 核心逻辑（300+ 行）
  - 支持 Markdown（默认）和 JSON 输出格式
  - 支持 `--skip-on-missing-model` 参数
  - 集成性能指标输出（合成时间、实时因子等）
  - 验证：Python 语法 ✅、文件结构 ✅
- [x] 2025-10-06 **阶段 1：抽离 Kokoro 文本分块模块并统一 wrapper 入口**
  - 创建 `kokoro-local/text_chunker.py`
  - 重构 `kokoro_wrapper.py` 使用新模块
  - 强化离线加载逻辑（环境变量 `KOKORO_LOCAL_MODEL_PATH`）
  - 迁移历史脚本到 `legacy/` 目录
  - 更新 `lib/kokoro-env.ts` 引用新 wrapper
  - 验证：Python 语法 ✅、Node 层引用 ✅、lint/test 通过 ✅
- [x] 2025-10-06 清理冗余文档：删除根目录 8 个历史总结文件，删除 documents/ 目录 25 个历史文件，保留核心文档结构（状态、看板、快照、路线图）。
