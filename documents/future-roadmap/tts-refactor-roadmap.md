# Kokoro TTS 模块整合与自检改造路线图

## 目的
- 统一 Kokoro TTS 的 Node/Python 层实现，减少入口脚本分裂导致的行为差异。
- 去除在线下载依赖，强制使用已有模型文件，确保离线环境稳定。
- 提供一个可独立运行的 CLI 自检脚本，部署前快速验证 GPU/CPU 运行链路。
- 让未来的维护者（含 AI 协作者）理解“哪些文件是权威来源、改动要点是什么”。

## 现状诊断
1. **入口脚本冗余**
   - 现有 `kokoro_wrapper.py`、`kokoro_wrapper_real.py`、`kokoro_wrapper_offline.py`、`kokoro_wrapper_interactive.py` 等多个版本。
   - Node 层默认调用 `kokoro_wrapper.py`，但分块逻辑/离线加载在其他文件里更完整，长期造成代码漂移。

2. **联网逻辑难控制**
   - 不同脚本各自尝试访问 Hugging Face，即使用离线模型也会偶尔触发联网下载。
   - 一旦网络不通，初始化就会阻塞；在 GitHub Actions 内尤其常见。

3. **长文本分块逻辑分散**
   - 分块阈值 / 策略在多个脚本中重复，调整阈值或润色分割算法时很难确保同步。

4. **缺乏独立自检工具**
   - 目前只能通过 Next.js API 调用 TTS，无法在部署机器上快速验证 GPU、模型、分块逻辑是否一致。

## 改造目标
1. **只保留一个权威 wrapper**
   - 采用 `kokoro_local/wrapper.py` 作为唯一入口。
   - 其余历史脚本移到 `kokoro_local/legacy/` 并加“deprecated”提示。

2. **抽离通用模块**
   - 新增 `kokoro_local/text_chunker.py`，封装所有分块函数（段落、句子、逗号、强制切分）。
   - wrapper 与 CLI 自检脚本统一从该模块导入分块逻辑，确保行为一致。

3. **彻底改为离线加载**
   - wrapper 在初始化时仅扫描固定路径：
     - `kokoro_local/.cache/huggingface/...`
     - `kokoro-models/Kokoro-82M/`
   - 未发现模型文件时直接抛出明确错误；取消所有联网下载尝试。

4. **设计 CLI 自检脚本**
   - 目录：`kokoro_local/selftest/`
   - 入口：`python -m kokoro_local.selftest --config configs/gpu.yaml`
   - 功能：
     - 读取配置（文本、语速、设备模式、输出路径）。
     - 运行一次或多次合成（CPU/GPU）并记录：耗时、chunk 数、模型路径、生成音频大小/时长。
     - 生成结构化报告（JSON 或 Markdown），方便粘贴进 issue/日志。
   - 脚本只调用 wrapper 暴露的 API，不写新的逻辑。

5. **文档与协作约束**
   - 在 `README.md` 或 `documents/SERVER_DEPLOYMENT_TEST_GUIDE.md` 中追加“使用自检脚本”章节。
   - 在协作守则中说明：`kokoro_local/wrapper.py`、`text_chunker.py`、`selftest/` 属于关键模块，修改需提前告知。

## 实施步骤建议
1. **代码清理**
   - 评估 legacy wrapper 与现行 wrapper 的差异。
   - 将有价值的扩展点（例如自定义日志、GPU 设备选择）合并入主 wrapper。
   - Legacy 文件移入 `legacy/` 目录并加注释，避免误用。

2. **模块抽离**
   - 把分块函数迁移到 `text_chunker.py`，wrapper 引入新模块。
   - 保留 `MAX_CHUNK_CHAR_SIZE` 等常量；如需配置化可放在 `kokoro_local/settings.py`。

3. **离线加载重构**
   - 明确模型/配置文件搜索顺序并写注释。
   - 增加对缺失文件的提示信息（包含建议路径）。

4. **CLI 自检实现**
   - 基于 wrapper 暴露的类编写 `selftest/__main__.py`。
   - 提供示例配置 `configs/default.yaml` 与 `configs/gpu.yaml`。
   - 报告格式建议：
     ```json
     {
       "timestamp": "...",
       "device": "...",
       "chunks": 4,
       "duration_seconds": 18.2,
       "model_path": "...",
       "wav_size_bytes": 1456320,
       "status": "success"
     }
     ```

5. **文档更新**
   - 在 `documents/WORKFLOW_TESTING_GUIDE.md` 或新文档中记录 CLI 用法、常见错误排查。
   - 将本文路线图合并到正式文档，供后续 AI/协作者执行。

## 验收标准
- Node 层（`lib/kokoro-service*.ts`）无需改动逻辑即可运行，并能调用新的分块模块。
- CLI 自检在 GitHub Actions（CPU 模式）与 GPU 服务器上都能输出结构化报告。
- 移除 legacy 脚本后，`npm run lint` / `npm run test` / `docker build` 全部通过。
- 文档明确列出“唯一权威入口”与“模型文件必须存在的路径”。

## 后续工作
- 完成此文档后，再为 CI/Docker 缓存流程撰写对应路线图。
- 编写协作守则，规范另一个 AI 的操作边界和提交流程。
