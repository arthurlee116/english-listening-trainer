# TTS 自检快照

- **最近测试**：2025-10-06，阶段 1 + 2 完成（代码重构 + CLI 自检脚本实现），设备：本地开发环境（MacOS）
- **结果摘要**：
  - 状态：✅ 成功（阶段 1 + 辅助函数重构 + 阶段 2 CLI 实现完成）
  - Python 语法检查：通过（`python3 -m py_compile`）
  - text_chunker 模块导入：通过（MAX_CHUNK_CHAR_SIZE=100）
  - Node 层引用验证：通过（所有服务文件已使用 `kokoro-env.ts` 辅助函数）
  - 辅助函数重构：完成（消除所有硬编码路径）
  - CLI 自检脚本：实现完成（语法验证通过）
  - lint 与 test：已运行（已存在错误与本次改动无关）
- **关键日志/报告**：
  ```bash
  # text_chunker 模块验证
  ✅ text_chunker import OK
     MAX_CHUNK_CHAR_SIZE=100
     Test split result: 1 chunks

  # Python 语法验证
  ✅ Python syntax validation passed

  # Node 层引用路径（已使用辅助函数）
  lib/kokoro-env.ts: Provides helper functions for all path resolution
  lib/kokoro-service-enhanced.ts: Uses resolveKokoroWrapperPath(), resolveKokoroPythonExecutable(), etc.
  lib/enhanced-tts-service.ts: Uses resolveKokoroWrapperPath(), resolveKokoroPythonExecutable(), etc.
  lib/config-manager.ts: Uses helpers for default TTS paths
  app/api/health/route.ts: Uses resolveKokoroWrapperPath() for path check

  # CLI 命令示例
  python -m kokoro_local.selftest --config configs/default.yaml               # Markdown 输出
  python -m kokoro_local.selftest --config configs/gpu.yaml --format json     # JSON 输出
  python -m kokoro_local.selftest --config configs/default.yaml --skip-on-missing-model  # CI 模式

  # 输出指标
  - 合成时间（synthesis_time_seconds）
  - 音频时长（audio_duration_seconds）
  - 实时因子（Real-time Factor）
  - Chunks 数量
  - 模型路径、设备信息、输出文件大小等
  ```
- **改动文件清单**：
  - **阶段 2 新增**：
    - `kokoro_local/selftest/__init__.py` (6 行)
    - `kokoro_local/selftest/__main__.py` (300+ 行)
    - `kokoro_local/configs/default.yaml` (CPU 配置)
    - `kokoro_local/configs/gpu.yaml` (GPU 配置)
  - **阶段 1**：
    - 新增：`kokoro_local/text_chunker.py`
    - 修改：`kokoro_local/kokoro_wrapper.py`
    - 修改：`lib/kokoro-env.ts`
    - 迁移：`kokoro_local/legacy/*.deprecated`（3 个文件）
  - **辅助函数重构**：
    - 修改：`lib/kokoro-service-enhanced.ts`
    - 修改：`lib/enhanced-tts-service.ts`
    - 修改：`lib/config-manager.ts`
    - 修改：`app/api/health/route.ts`
    - 修改：`vitest.config.ts`
- **问题 & 备注**：
  - 本地环境缺少依赖（torch, PyYAML），无法完整运行 CLI，但代码结构和语法验证已通过
  - 环境变量 `KOKORO_LOCAL_MODEL_PATH` 已在 `kokoro_wrapper.py` 第 128 行实现优先级扫描
  - 离线模式已强制启用（第 119-120 行）
  - 所有 Node.js 服务现已使用 `kokoro-env.ts` 辅助函数，避免硬编码路径
  - CLI 集成了阶段 1 的所有功能：
    - `KOKORO_LOCAL_MODEL_PATH` 环境变量自动检测
    - `text_chunker` 模块调用
    - `kokoro_wrapper.KokoroTTSWrapper` 异步接口
  - Markdown 输出包含：性能指标、配置信息、输出文件路径
  - JSON 输出包含：所有元数据的结构化格式
- **下一步动作**：
  - 阶段 3：集成到 GitHub Actions workflow
  - 在真实环境（有模型文件 + 完整依赖）中运行完整验证
  - 验证 `--skip-on-missing-model` 在 CI 中的行为
