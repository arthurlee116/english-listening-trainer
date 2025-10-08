# 项目状态总表

> 最近更新：2025-10-07（Phase 4 文档交付）。更新本文件时同步调整此处日期。

## 当前核心目标
- [x] CI/Docker 缓存优化（详见 `documents/future-roadmap/ci-docker-cache-roadmap.md`）。负责人：Claude。进度：Phase 4 已完成 ✅
- [x] 重构 Kokoro TTS 模块并落地自检 CLI（详见 `documents/future-roadmap/tts-refactor-roadmap.md`）。负责人：待指定。进度：全部 4 阶段已完成 ✅

## 最近里程碑
- 2025-10-07 **Phase 4: 缓存与部署文档完善**
  - 新增《CACHE_MANAGEMENT_GUIDE.md》，覆盖刷新策略、季度切换、配额监控与故障恢复
  - 创建《SERVER_DEPLOYMENT_TEST_GUIDE.md》，补充远程服务器预热步骤、部署清单与排查模板
  - 创建《WORKFLOW_TESTING_GUIDE.md》，定义预热/主 workflow 验证流程与缓存命中率计算方法
  - 同步状态/看板/快照/路线图，标记 Phase 4 结束与整体路线图完成
- 2025-10-07 **Phase 3: 主构建工作流切换至多级缓存链**
  - 更新 `.github/workflows/build-and-push.yml`，改用 registry `cache-base/cache-python/cache-node/cache-builder` 链
  - 移除 `actions/cache` + 本地目录迁移逻辑，统一推送 `cache-builder`（zstd 压缩）
  - 新增磁盘空间检查（`df -h` + 4GB 阈值）及 BuildKit 日志命中统计写入 Summary
  - 添加 `rebuild-deps-cache` 输入项，提醒触发 `prewarm-deps.yml` 以刷新依赖层
  - Summary 输出包含命中行数与后续建议
- 2025-10-07 **Phase 2: 依赖缓存预热工作流完成**
  - 创建 `.github/workflows/prewarm-deps.yml`（280 行）
  - 实现三层缓存预热：base → python → node
  - 推送策略：滚动标签 + 季度标签（2025Q4）
  - 定时执行：每周一 02:00 UTC
  - 磁盘管理：每层构建前清理 + 4GB 阈值检查
  - 跳过 builder 层（体积控制，避免无效缓存）
  - Summary 输出：缓存标签表格 + 使用指南
  - 下一步：Phase 3 - 调整主 workflow 使用多级 cache-from
- 2025-10-07 **Phase 1: 基础镜像内刊化完成（含 cuDNN8 标签修复）**
  - 推送 CUDA 基础镜像至 GHCR：`ghcr.io/arthurlee116/base-images/cuda:12.1.1-cudnn8-runtime-ubuntu22.04`
  - Digest: `sha256:b2c52e5236a0cb72d88444dca87eaf69c8e79836b875f20ad58f4b65c12faa34`
  - 镜像大小：3.38GB
  - **关键修复**：保留 `cudnn8` 后缀，确保与 PyTorch/TensorFlow libcudnn8 依赖兼容
  - cuDNN 版本验证：`libcudnn8 8.9.0.131-1+cuda12.1` ✅
  - 更新 `Dockerfile` 和 `Dockerfile.optimized` FROM 行引用正确标签
  - 配置远程服务器 Docker 镜像加速器（daocloud, 1panel, dockerproxy）
  - 下一步：Phase 2 - 创建依赖缓存预热工作流
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
- [ ] 每季度初检查远程部署机缓存是否仍命中（参考《服务器部署与缓存预热指南》）

## 下一步计划
- 本周：开始其他规划任务。
- 待定：根据需要启动新的改造项目。

## 参考文档
- CI 缓存路线图：`documents/future-roadmap/ci-docker-cache-roadmap.md`
- TTS 重构路线图：`documents/future-roadmap/tts-refactor-roadmap.md`
- 协作守则：`documents/future-roadmap/ai-collaboration-guidelines.md`
