# Requirements Document: Kokoro TTS 模块重构

## Introduction

本需求文档定义了 Kokoro TTS 模块的全面重构计划。当前系统存在多个入口脚本（kokoro_wrapper.py、kokoro_wrapper_real.py、kokoro_wrapper_offline.py、kokoro_wrapper_interactive.py），导致代码分裂、行为不一致，且存在意外联网下载的风险。

重构目标是：
1. 统一所有 TTS 入口为单一权威 wrapper
2. 抽离并标准化文本分块逻辑
3. 强制离线模型加载，彻底消除联网依赖
4. 提供独立的 CLI 自检工具用于部署验证
5. 确保 Node.js 层无缝兼容新架构

本重构将提升系统可维护性、可测试性和部署可靠性，特别是在离线环境和 CI/CD 流程中。

---

## Requirements

### Requirement 1: 统一 Wrapper 入口

**User Story:** 作为系统维护者，我希望只有一个权威的 TTS wrapper 入口点，以便所有调用方（Node.js、CLI、测试）使用相同的实现，避免行为差异和维护成本。

#### Acceptance Criteria

1. WHEN 系统初始化 TTS 服务 THEN 系统 SHALL 仅使用 `kokoro_local/wrapper.py` 作为唯一入口点
2. WHEN 历史 wrapper 脚本存在 THEN 系统 SHALL 将它们移动到 `kokoro_local/legacy/` 目录
3. WHEN 用户尝试使用 legacy wrapper THEN 系统 SHALL 在脚本顶部显示 deprecated 警告信息
4. WHEN Node.js 服务调用 TTS THEN 系统 SHALL 通过 `lib/kokoro-env.ts` 的 `resolveKokoroWrapperPath()` 解析到新的 wrapper 路径
5. IF 环境变量 `KOKORO_WRAPPER_PATH` 未设置 THEN 系统 SHALL 默认使用 `kokoro-local/wrapper.py`
6. WHEN wrapper 初始化完成 THEN 系统 SHALL 输出包含 "service is ready" 的日志消息
7. WHEN wrapper 接收 JSON 请求 THEN 系统 SHALL 返回包含 `success`、`audio_data`、`device`、`error` 字段的 JSON 响应

---

### Requirement 2: 抽离文本分块模块

**User Story:** 作为开发者，我希望文本分块逻辑独立于 wrapper 实现，以便在 Python CLI、Node.js 服务和测试中复用相同的分块策略，确保行为一致性。

#### Acceptance Criteria


1. WHEN 系统需要分块长文本 THEN 系统 SHALL 使用 `kokoro_local/text_chunker.py` 模块中的函数
2. WHEN text_chunker 模块被导入 THEN 系统 SHALL 提供以下函数：
   - `split_by_paragraphs(text: str) -> List[str]`
   - `split_by_sentences(text: str) -> List[str]`
   - `split_by_commas(text: str) -> List[str]`
   - `force_split_by_char_limit(text: str, max_chars: int) -> List[str]`
   - `smart_chunk_text(text: str, max_chunk_size: int) -> List[str]`
3. WHEN 分块函数处理文本 THEN 系统 SHALL 保留原始文本的语义边界（段落、句子、逗号）
4. IF 单个语义单元超过 `max_chunk_size` THEN 系统 SHALL 使用 `force_split_by_char_limit()` 强制切分
5. WHEN wrapper.py 需要分块 THEN 系统 SHALL 从 text_chunker 导入并调用 `smart_chunk_text()`
6. WHEN CLI 自检脚本需要分块 THEN 系统 SHALL 从 text_chunker 导入并调用相同函数
7. WHEN 分块完成 THEN 系统 SHALL 返回非空字符串列表，且每个 chunk 不超过指定的 `max_chunk_size`
8. WHEN text_chunker 模块定义常量 THEN 系统 SHALL 包含 `MAX_CHUNK_CHAR_SIZE`（默认值：500）和 `MIN_CHUNK_CHAR_SIZE`（默认值：10）

---

### Requirement 3: 强制离线模型加载

**User Story:** 作为部署工程师，我希望 TTS 系统完全离线运行，不尝试任何网络下载，以便在隔离环境、CI/CD 和生产服务器上可靠运行。

#### Acceptance Criteria

1. WHEN wrapper 初始化模型 THEN 系统 SHALL 仅扫描以下本地路径：
   - `kokoro-local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/`
   - `kokoro-models/Kokoro-82M/`
2. IF 模型文件在上述路径中不存在 THEN 系统 SHALL 抛出明确错误并终止初始化
3. WHEN 模型文件缺失 THEN 错误消息 SHALL 包含：
   - 缺失的文件名或路径
   - 建议的模型下载/安装步骤
   - 预期的目录结构示例
4. WHEN wrapper 加载模型 THEN 系统 SHALL NOT 调用任何 Hugging Face Hub API
5. WHEN wrapper 加载模型 THEN 系统 SHALL NOT 尝试访问任何外部 URL
6. WHEN 环境变量 `HF_HUB_OFFLINE` 存在 THEN 系统 SHALL 设置其值为 `1`
7. WHEN 环境变量 `TRANSFORMERS_OFFLINE` 存在 THEN 系统 SHALL 设置其值为 `1`
8. WHEN wrapper 在离线环境初始化 THEN 系统 SHALL 在 120 秒内完成初始化（CPU 模式）或 600 秒内完成（GPU 模式）
9. IF 网络不可用 THEN 系统 SHALL 仍能成功初始化和生成音频
10. WHEN 模型加载成功 THEN 系统 SHALL 在日志中输出实际使用的模型路径

---

### Requirement 4: CLI 自检工具实现

**User Story:** 作为运维人员，我希望有一个独立的 CLI 工具来验证 TTS 系统配置（CPU/GPU、模型路径、分块逻辑），并生成结构化报告，以便在部署前快速诊断问题。

#### Acceptance Criteria


1. WHEN 用户运行 `python -m kokoro_local.selftest` THEN 系统 SHALL 执行自检流程
2. WHEN 用户提供 `--config` 参数 THEN 系统 SHALL 从指定的 YAML 配置文件加载测试参数
3. IF `--config` 参数未提供 THEN 系统 SHALL 使用 `configs/default.yaml` 作为默认配置
4. WHEN 配置文件被加载 THEN 系统 SHALL 解析以下字段：
   - `text`: 测试文本内容
   - `speed`: 语速（默认 1.0）
   - `device`: 设备模式（auto/cpu/cuda/mps）
   - `output_dir`: 输出目录（默认 `public/`）
   - `language`: 语言代码（默认 en-US）
5. WHEN 自检脚本执行 THEN 系统 SHALL 仅调用 `wrapper.py` 暴露的公共 API
6. WHEN 自检脚本生成音频 THEN 系统 SHALL 记录以下指标：
   - 总耗时（秒）
   - 文本分块数量
   - 实际使用的模型路径
   - 生成的音频文件大小（字节）
   - 音频时长（秒）
   - 实际使用的设备（CPU/CUDA/MPS）
   - 执行状态（success/failure）
7. WHEN 自检完成 THEN 系统 SHALL 输出 JSON 格式的报告到 stdout
8. WHEN 自检完成 THEN 系统 SHALL 可选地输出 Markdown 格式的报告（使用 `--format markdown` 参数）
9. WHEN 自检失败 THEN 系统 SHALL 返回非零退出码
10. WHEN 自检成功 THEN 系统 SHALL 返回退出码 0
11. WHEN 用户运行 `python -m kokoro_local.selftest --help` THEN 系统 SHALL 显示完整的使用说明和参数列表
12. WHEN 自检脚本运行 THEN 系统 SHALL 支持 `--verbose` 参数以输出详细日志
13. WHEN 配置文件示例存在 THEN 系统 SHALL 提供 `configs/default.yaml` 和 `configs/gpu.yaml` 两个模板

**JSON 报告格式示例：**
```json
{
  "timestamp": "2025-10-06T10:30:45Z",
  "device": "cuda",
  "chunks": 4,
  "duration_seconds": 18.2,
  "model_path": "kokoro-models/Kokoro-82M/",
  "wav_size_bytes": 1456320,
  "total_time_seconds": 3.45,
  "status": "success",
  "errors": []
}
```

---

### Requirement 5: Node.js 层兼容性保持

**User Story:** 作为应用开发者，我希望 Node.js TTS 服务层（kokoro-service.ts 和 kokoro-service-gpu.ts）无需大规模改动即可使用新的 wrapper，以便平滑迁移到新架构。

#### Acceptance Criteria

1. WHEN Node.js 服务初始化 THEN 系统 SHALL 通过 `resolveKokoroWrapperPath()` 自动解析到新的 wrapper 路径
2. WHEN wrapper 路径变更 THEN `lib/kokoro-env.ts` 中的 `DEFAULT_WRAPPER_PATH` SHALL 更新为 `kokoro-local/wrapper.py`
3. WHEN Node.js 服务调用 `generateAudio()` THEN 系统 SHALL 保持现有的函数签名和返回类型
4. WHEN wrapper 返回响应 THEN JSON 格式 SHALL 与现有格式兼容（包含 `success`、`audio_data`、`device`、`error` 字段）
5. WHEN Node.js 服务需要分块逻辑 THEN 系统 SHALL 可选地从 Python text_chunker 导入（通过子进程调用）或在 TypeScript 中实现等效逻辑
6. WHEN 现有测试套件运行 THEN 系统 SHALL 通过所有 TTS 相关的单元测试和集成测试
7. WHEN `npm run lint` 执行 THEN 系统 SHALL 不产生新的 linting 错误
8. WHEN `npm run test -- --run` 执行 THEN 系统 SHALL 通过所有测试用例

---

### Requirement 6: 长文本分块验证

**User Story:** 作为质量保证工程师，我希望系统能正确处理超长文本（>10000 字符），确保分块逻辑不会丢失内容、产生空块或触发联网下载。

#### Acceptance Criteria


1. WHEN 输入文本长度超过 10000 字符 THEN 系统 SHALL 成功分块并生成音频
2. WHEN 文本被分块 THEN 系统 SHALL 确保所有原始字符都被包含在某个 chunk 中（无丢失）
3. WHEN 文本被分块 THEN 系统 SHALL NOT 产生空字符串 chunk
4. WHEN 文本被分块 THEN 每个 chunk SHALL 不超过 `MAX_CHUNK_CHAR_SIZE` 配置值
5. WHEN 处理长文本 THEN 系统 SHALL NOT 尝试任何网络请求
6. WHEN 处理长文本 THEN 系统 SHALL 在合理时间内完成（<5 分钟，取决于文本长度和设备）
7. WHEN 长文本包含多种标点符号 THEN 系统 SHALL 优先在段落边界分块，其次句子边界，最后逗号边界
8. WHEN 单个句子超过 `MAX_CHUNK_CHAR_SIZE` THEN 系统 SHALL 使用强制字符切分
9. WHEN 自检脚本测试长文本 THEN 系统 SHALL 在报告中显示实际分块数量
10. WHEN 长文本测试完成 THEN 系统 SHALL 验证生成的音频文件大小 > 0 且时长 > 0

---

### Requirement 7: CPU/GPU 模式切换验证

**User Story:** 作为系统管理员，我希望能够在 CPU 和 GPU 模式之间无缝切换，并验证每种模式都能正确初始化和生成音频，以便根据硬件资源灵活部署。

#### Acceptance Criteria

1. WHEN 环境变量 `KOKORO_DEVICE=cpu` THEN 系统 SHALL 使用 CPU 模式初始化
2. WHEN 环境变量 `KOKORO_DEVICE=cuda` THEN 系统 SHALL 使用 CUDA GPU 模式初始化
3. WHEN 环境变量 `KOKORO_DEVICE=mps` THEN 系统 SHALL 使用 Apple Metal (MPS) 模式初始化
4. WHEN 环境变量 `KOKORO_DEVICE=auto` THEN 系统 SHALL 根据 `detectKokoroDevicePreference()` 自动选择设备
5. IF 环境变量未设置 THEN 系统 SHALL 默认使用 `auto` 模式
6. WHEN wrapper 初始化完成 THEN 系统 SHALL 在日志中输出实际使用的设备类型
7. WHEN 自检脚本运行 THEN 系统 SHALL 在报告中包含 `device` 字段，显示实际使用的设备
8. WHEN 从 CPU 切换到 GPU THEN 系统 SHALL 重新初始化模型并使用新设备
9. WHEN GPU 不可用但请求 CUDA 模式 THEN 系统 SHALL 输出警告并回退到 CPU 模式
10. WHEN MPS 不可用但请求 MPS 模式 THEN 系统 SHALL 输出警告并回退到 CPU 模式
11. WHEN 自检脚本使用 `configs/gpu.yaml` THEN 系统 SHALL 强制使用 GPU 模式（如果可用）
12. WHEN 自检脚本使用 `configs/default.yaml` THEN 系统 SHALL 使用 auto 模式

---

### Requirement 8: 离线环境验证

**User Story:** 作为 CI/CD 工程师，我希望在完全离线的环境中（无互联网连接）运行 TTS 系统，确保不会因网络问题导致初始化失败或超时。

#### Acceptance Criteria

1. WHEN 系统在离线环境运行 THEN 系统 SHALL 成功初始化 wrapper
2. WHEN 系统在离线环境运行 THEN 系统 SHALL 成功生成音频
3. WHEN 网络接口被禁用 THEN 系统 SHALL NOT 产生网络相关的错误或警告
4. WHEN 系统在离线环境运行 THEN 初始化时间 SHALL 与在线环境相同（无额外超时）
5. WHEN 环境变量 `HF_HUB_OFFLINE=1` 设置 THEN 系统 SHALL 完全禁用 Hugging Face Hub 访问
6. WHEN 环境变量 `TRANSFORMERS_OFFLINE=1` 设置 THEN 系统 SHALL 完全禁用 Transformers 库的在线功能
7. WHEN 自检脚本在离线环境运行 THEN 系统 SHALL 返回 `status: success`
8. WHEN Docker 容器在无网络模式运行 THEN 系统 SHALL 正常工作
9. WHEN GitHub Actions CI 运行 THEN 系统 SHALL 在无外部网络访问的情况下通过测试
10. WHEN 离线验证失败 THEN 错误消息 SHALL 明确指出是模型文件缺失而非网络问题

---

### Requirement 9: 文档与协作守则更新

**User Story:** 作为新加入的开发者或 AI 协作者，我希望文档清晰说明新的 TTS 架构、关键模块和使用方法，以便快速理解系统并避免误用 legacy 代码。

#### Acceptance Criteria


1. WHEN 重构完成 THEN `README.md` SHALL 包含"Kokoro TTS 自检"章节
2. WHEN 文档更新 THEN 系统 SHALL 说明以下内容：
   - 唯一权威 wrapper 路径（`kokoro-local/wrapper.py`）
   - 离线模型路径要求
   - CLI 自检工具使用方法
   - 配置文件示例和参数说明
3. WHEN 文档更新 THEN `documents/future-roadmap/ai-collaboration-guidelines.md` SHALL 标注 `kokoro_local/wrapper.py`、`text_chunker.py`、`selftest/` 为关键模块
4. WHEN 文档更新 THEN `documents/SERVER_DEPLOYMENT_TEST_GUIDE.md` SHALL 包含 TTS 自检步骤
5. WHEN 文档更新 THEN `documents/WORKFLOW_TESTING_GUIDE.md` SHALL 包含 TTS 测试场景
6. WHEN 文档更新 THEN 系统 SHALL 提供常见错误排查指南（模型缺失、设备不可用、权限问题等）
7. WHEN legacy 脚本被移动 THEN `kokoro-local/legacy/README.md` SHALL 说明这些文件已废弃并指向新 wrapper
8. WHEN 配置示例创建 THEN `configs/default.yaml` 和 `configs/gpu.yaml` SHALL 包含注释说明每个参数的作用
9. WHEN 文档更新 THEN 系统 SHALL 在 `documents/project-status.md` 中更新 TTS 重构的里程碑状态
10. WHEN 文档更新 THEN 系统 SHALL 在 `documents/project-board.md` 中将相关任务移至 Done 栏

---

### Requirement 10: 测试覆盖与验证

**User Story:** 作为测试工程师，我希望有完整的测试覆盖来验证新架构的正确性，包括单元测试、集成测试和端到端测试。

#### Acceptance Criteria

1. WHEN 重构完成 THEN 系统 SHALL 包含 `text_chunker.py` 的单元测试
2. WHEN 单元测试运行 THEN 系统 SHALL 验证以下场景：
   - 空文本处理
   - 短文本（<MAX_CHUNK_CHAR_SIZE）
   - 长文本（>MAX_CHUNK_CHAR_SIZE）
   - 多段落文本
   - 无标点符号文本
   - 特殊字符和 Unicode
3. WHEN 集成测试运行 THEN 系统 SHALL 验证 wrapper 与 text_chunker 的集成
4. WHEN 集成测试运行 THEN 系统 SHALL 验证 Node.js 服务与新 wrapper 的集成
5. WHEN 端到端测试运行 THEN 系统 SHALL 从 API 请求到音频生成完整流程
6. WHEN `npm run test -- --run` 执行 THEN 所有测试 SHALL 通过
7. WHEN `npm run lint` 执行 THEN 系统 SHALL 无 linting 错误
8. WHEN 自检脚本作为测试运行 THEN 系统 SHALL 在 CI 环境中成功执行
9. WHEN Docker 构建测试运行 THEN 系统 SHALL 成功构建镜像并通过健康检查
10. WHEN 测试覆盖率报告生成 THEN 新增代码 SHALL 达到至少 80% 的覆盖率

---

## Technical Constraints

1. **Python 版本**: 必须支持 Python 3.8-3.12（不支持 3.13+）
2. **PyTorch 依赖**: 需要 PyTorch 1.x 或 2.x，支持 CPU、CUDA、MPS 后端
3. **Node.js 版本**: 需要 Node.js 18+
4. **操作系统**: 主要支持 macOS（Apple Silicon 优化），兼容 Linux（CUDA）
5. **模型文件**: Kokoro-82M 模型文件总大小约 330MB
6. **内存要求**: CPU 模式至少 2GB RAM，GPU 模式至少 4GB VRAM
7. **文件系统**: 需要对 `kokoro-local/`、`kokoro-models/`、`public/` 目录的读写权限
8. **环境变量**: 支持 `KOKORO_DEVICE`、`KOKORO_WRAPPER_PATH`、`HF_HUB_OFFLINE`、`TRANSFORMERS_OFFLINE` 等
9. **JSON 通信**: wrapper 使用 stdin/stdout 进行 JSON 行协议通信
10. **音频格式**: 输出 WAV 格式，16-bit PCM，采样率由模型决定（通常 24kHz）

---

## Success Criteria

重构成功的标准：

1. ✅ 所有 4 个历史 wrapper 脚本已移至 `kokoro-local/legacy/` 并标记为 deprecated
2. ✅ `kokoro-local/wrapper.py` 成为唯一活跃的入口点
3. ✅ `kokoro-local/text_chunker.py` 模块已创建并被 wrapper 和 CLI 使用
4. ✅ 离线模型加载已实现，无任何联网尝试
5. ✅ CLI 自检工具 `python -m kokoro_local.selftest` 可运行并生成报告
6. ✅ `configs/default.yaml` 和 `configs/gpu.yaml` 配置文件已创建
7. ✅ Node.js 服务（`lib/kokoro-service.ts` 和 `lib/kokoro-service-gpu.ts`）无需改动或仅需最小改动
8. ✅ 所有现有测试通过（`npm run test -- --run`）
9. ✅ Linting 无错误（`npm run lint`）
10. ✅ 文档已更新（README.md、协作守则、部署指南）
11. ✅ 在完全离线环境中验证通过
12. ✅ CPU 和 GPU 模式切换验证通过
13. ✅ 长文本（>10000 字符）处理验证通过
14. ✅ Docker 构建和部署测试通过
15. ✅ `documents/project-status.md` 和 `documents/project-board.md` 已更新

---

## Out of Scope

以下内容不在本次重构范围内：

1. ❌ 更换 Kokoro 模型或添加新的语音模型
2. ❌ 修改音频格式（保持 WAV 输出）
3. ❌ 优化模型推理性能（保持现有性能）
4. ❌ 添加新的语言支持（保持现有语言配置）
5. ❌ 重构 Node.js 服务的电路断路器逻辑
6. ❌ 修改音频清理服务（`audio-cleanup-service.ts`）
7. ❌ 更改 API 端点或请求/响应格式
8. ❌ 添加实时流式音频生成
9. ❌ 实现音频缓存机制
10. ❌ 修改前端音频播放器组件

---

## Risk Assessment

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Node.js 服务与新 wrapper 不兼容 | 高 | 保持 JSON 协议格式不变，增加集成测试 |
| 离线模型路径在不同环境不一致 | 中 | 提供清晰的路径配置文档和环境变量支持 |
| 长文本分块逻辑错误导致内容丢失 | 高 | 编写全面的单元测试，验证字符完整性 |
| GPU 模式在某些环境不可用 | 中 | 实现自动回退到 CPU 模式 |
| Legacy 脚本被误用 | 低 | 添加 deprecated 警告，更新文档 |
| CLI 自检工具输出格式不满足需求 | 低 | 提供 JSON 和 Markdown 两种格式 |
| Docker 构建时模型文件缺失 | 中 | 在 Dockerfile 中添加模型文件验证步骤 |
| CI 环境初始化超时 | 中 | 增加超时时间，优化模型加载逻辑 |

---

## Dependencies

- **Python 包**: torch, numpy, scipy, pyyaml（用于配置解析）
- **Node.js 包**: 无新增依赖
- **外部资源**: Kokoro-82M 模型文件（需预先下载）
- **系统工具**: Python 3.8-3.12, Node.js 18+
- **开发工具**: pytest（Python 测试）, vitest（Node.js 测试）

---

## Glossary

- **Wrapper**: Python 脚本，作为 TTS 引擎的入口点，接收 JSON 请求并返回音频数据
- **Text Chunker**: 文本分块模块，将长文本切分为适合 TTS 处理的小块
- **CLI Selftest**: 命令行自检工具，用于验证 TTS 系统配置和功能
- **Offline Loading**: 离线加载，指不访问网络仅从本地文件系统加载模型
- **EARS**: Easy Approach to Requirements Syntax，一种需求编写格式
- **Circuit Breaker**: 电路断路器，防止级联故障的设计模式
- **MPS**: Metal Performance Shaders，Apple Silicon 的 GPU 加速框架
- **CUDA**: NVIDIA 的 GPU 计算平台
- **Legacy**: 遗留代码，指已废弃但保留用于参考的旧实现
