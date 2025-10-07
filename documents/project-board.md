# 工作流与功能看板

## To-Do
- [ ] Phase 2: 编写并验证 `.github/workflows/prewarm-deps.yml`（依赖缓存预热工作流）
- [ ] Phase 3: 调整主 workflow 使用多级 cache-from
- [ ] Phase 4: 完善部署文档与缓存管理指南

## In Progress
- [ ] （暂无）

## Review
- [ ] （留空，提交 PR 后填入）

## Done
- [x] 2025-10-07 **Phase 1: 基础镜像内刊化（含 cuDNN8 标签修复）**
  - 推送 CUDA 基础镜像至 GHCR（digest: sha256:b2c52e...c12faa34）
  - **修复标签命名**：保留 `cudnn8` 后缀 → `12.1.1-cudnn8-runtime-ubuntu22.04`
  - 验证 cuDNN 版本：libcudnn8 8.9.0.131 ✅
  - 更新 `Dockerfile` 和 `Dockerfile.optimized` FROM 行使用正确标签
  - 配置远程服务器 Docker 镜像加速器
  - 更新项目文档（status/board/snapshot/roadmap）
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
- [x] 2025-10-06 **代码重构：使用 kokoro-env 辅助函数消除硬编码路径**
  - 重构 4 个 TypeScript 服务文件使用 `lib/kokoro-env.ts` 辅助函数
  - 替换硬编码路径为 `resolveKokoroWrapperPath()`, `resolveKokoroPythonExecutable()`, `resolveKokoroWorkingDirectory()`, `buildKokoroPythonEnv()`
  - 修改文件：
    - `lib/kokoro-service-enhanced.ts` (导入并使用辅助函数)
    - `lib/enhanced-tts-service.ts` (导入并使用辅助函数)
    - `lib/config-manager.ts` (使用辅助函数设置默认 TTS 路径)
    - `app/api/health/route.ts` (使用辅助函数进行路径检查)
  - 优势：单一数据源、环境变量覆盖支持、自动 venv 检测、跨平台兼容性
  - 验证：ESLint 通过 ✅
- [x] 2025-10-06 **阶段 1：抽离 Kokoro 文本分块模块并统一 wrapper 入口**
  - 创建 `kokoro_local/text_chunker.py`
  - 重构 `kokoro_wrapper.py` 使用新模块
  - 强化离线加载逻辑（环境变量 `KOKORO_LOCAL_MODEL_PATH`）
  - 迁移历史脚本到 `legacy/` 目录
  - 更新 `lib/kokoro-env.ts` 引用新 wrapper
  - 验证：Python 语法 ✅、Node 层引用 ✅、lint/test 通过 ✅
- [x] 2025-10-06 清理冗余文档：删除根目录 8 个历史总结文件，删除 documents/ 目录 25 个历史文件，保留核心文档结构（状态、看板、快照、路线图）。
