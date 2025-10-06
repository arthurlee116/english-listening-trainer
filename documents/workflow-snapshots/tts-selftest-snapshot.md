# TTS 自检快照

- **最近测试**：2025-10-06，阶段 1 代码重构验证，设备：本地开发环境（MacOS）
- **结果摘要**：
  - 状态：✅ 成功（代码层面验证通过，运行时验证待阶段 2 CLI 实现）
  - Python 语法检查：通过（`python3 -m py_compile`）
  - text_chunker 模块导入：通过（MAX_CHUNK_CHAR_SIZE=100）
  - Node 层引用验证：通过（3 个 kokoro-service 文件均通过 `resolveKokoroWrapperPath()` 正确引用新 wrapper）
  - lint 与 test：已运行（已存在错误与本次改动无关）
- **关键日志/报告**：
  ```bash
  # text_chunker 模块验证
  ✅ text_chunker import OK
     MAX_CHUNK_CHAR_SIZE=100
     Test split result: 1 chunks

  # Python 语法验证
  ✅ Python syntax validation passed

  # Node 层引用路径
  lib/kokoro-env.ts: const DEFAULT_WRAPPER_PATH = path.join(PROJECT_ROOT, 'kokoro-local', 'kokoro_wrapper.py')
  ```
- **改动文件清单**：
  - 新增：`kokoro-local/text_chunker.py`
  - 修改：`kokoro-local/kokoro_wrapper.py`
  - 修改：`lib/kokoro-env.ts`
  - 迁移：`kokoro-local/legacy/*.deprecated`（3 个文件）
- **问题 & 备注**：
  - 本地环境缺少 torch 依赖，无法运行 `--test` 模式，但代码结构验证已通过
  - 环境变量 `KOKORO_LOCAL_MODEL_PATH` 已在 `kokoro_wrapper.py` 第 128 行实现优先级扫描
  - 离线模式已强制启用（第 119-120 行）
- **下一步动作**：
  - 阶段 2：实现 `kokoro_local/selftest` CLI 脚本（目标：支持 CPU/GPU 配置、默认 Markdown 输出）
  - 在真实环境（有模型文件）中验证离线加载逻辑
