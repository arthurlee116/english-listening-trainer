# Design Document: Kokoro TTS 模块重构

## Overview

本设计文档描述了 Kokoro TTS 模块重构的技术架构和实现方案。重构的核心目标是统一入口、标准化分块逻辑、强制离线加载，并提供独立的 CLI 自检工具。

### Design Goals

1. **单一职责原则**: 每个模块有明确的职责边界
2. **可测试性**: 所有核心逻辑可独立测试
3. **向后兼容**: Node.js 层无需大规模改动
4. **离线优先**: 完全消除网络依赖
5. **可观测性**: 提供详细的日志和诊断工具

### Key Design Decisions

| 决策 | 理由 | 权衡 |
|------|------|------|
| 使用 `wrapper.py` 作为唯一入口 | 简化维护，避免代码分裂 | 需要迁移现有调用方 |
| 抽离 `text_chunker.py` 模块 | 复用分块逻辑，确保一致性 | 增加一个新模块 |
| 强制离线模型加载 | 提升可靠性，避免网络问题 | 需要预先下载模型 |
| CLI 自检工具使用 YAML 配置 | 灵活配置测试场景 | 增加配置文件管理 |
| 保持 JSON 行协议 | 与现有 Node.js 服务兼容 | 限制了协议扩展性 |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────────┐         ┌──────────────────────────┐  │
│  │  Node.js Service │         │   CLI Selftest Tool      │  │
│  │  (kokoro-service │         │  (kokoro_local.selftest) │  │
│  │   .ts/.gpu.ts)   │         │                          │  │
│  └────────┬─────────┘         └────────┬─────────────────┘  │
│           │                             │                    │
│           │ JSON over stdin/stdout      │                    │
│           │                             │                    │
└───────────┼─────────────────────────────┼────────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Python TTS Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           kokoro_local/wrapper.py                    │   │
│  │  (Unified Entry Point)                               │   │
│  │  - Device setup (CPU/CUDA/MPS)                       │   │
│  │  - Model initialization (offline)                    │   │
│  │  - Request/Response handling                         │   │
│  │  - Audio generation orchestration                    │   │
│  └──────────────┬───────────────────────┬────────────────┘   │
│                 │                       │                    │
│                 ▼                       ▼                    │
│  ┌──────────────────────┐   ┌──────────────────────────┐   │
│  │ text_chunker.py      │   │  Kokoro Pipeline         │   │
│  │ - split_by_paragraphs│   │  (KPipeline, KModel)     │   │
│  │ - split_by_sentences │   │  - Voice loading         │   │
│  │ - split_by_commas    │   │  - Audio synthesis       │   │
│  │ - force_split        │   │  - Device management     │   │
│  │ - smart_chunk_text   │   │                          │   │
│  └──────────────────────┘   └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model & Data Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Local Model Files (Offline)                         │   │
│  │  - kokoro_local/.cache/huggingface/...               │   │
│  │  - kokoro-models/Kokoro-82M/                         │   │
│  │  - kokoro_local/voices/*.pt                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module Dependency Graph

```
wrapper.py
  ├── text_chunker.py (分块逻辑)
  ├── kokoro.pipeline.KPipeline (TTS 引擎)
  ├── kokoro.model.KModel (模型加载)
  └── torch (设备管理)

selftest/__main__.py
  ├── wrapper.py (通过 API 调用)
  ├── yaml (配置解析)
  └── json (报告生成)

kokoro-service.ts
  ├── kokoro-env.ts (路径解析)
  └── wrapper.py (通过子进程)
```

---

## Components and Interfaces

### 1. Unified Wrapper (`kokoro_local/wrapper.py`)

**职责**: 作为唯一的 TTS 入口点，处理所有音频生成请求

**核心类**: `KokoroTTSService`


**公共接口**:

```python
class KokoroTTSService:
    def __init__(self):
        """初始化服务，设置设备和离线模式"""
        
    def setup_device(self) -> None:
        """检测并设置计算设备 (CPU/CUDA/MPS)"""
        
    def initialize_model_offline(self) -> None:
        """从本地路径加载模型，不访问网络"""
        
    def get_pipeline(self, lang_code: str, voice: str) -> KPipeline:
        """获取或创建指定语言和语音的 pipeline"""
        
    def synthesize_audio(self, text: str, voice: str, speed: float, lang_code: str) -> str:
        """合成音频并返回十六进制字符串"""
        
    def process_request(self, request_data: str) -> dict:
        """处理 JSON 请求并返回响应"""
        
    def run(self) -> None:
        """运行服务主循环，监听 stdin"""
```

**请求格式** (JSON):
```json
{
  "text": "Hello, world!",
  "speed": 1.0,
  "lang_code": "a",
  "voice": "af_bella"
}
```

**响应格式** (JSON):
```json
{
  "success": true,
  "audio_data": "52494646...",
  "device": "cuda",
  "message": "Audio synthesized (offline mode)"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "Model file not found at expected path"
}
```

---

### 2. Text Chunker Module (`kokoro_local/text_chunker.py`)

**职责**: 提供统一的文本分块逻辑，供 wrapper 和 CLI 使用

**公共函数**:

```python
# 常量
MAX_CHUNK_CHAR_SIZE: int = 500
MIN_CHUNK_CHAR_SIZE: int = 10

def split_by_paragraphs(text: str) -> List[str]:
    """按段落分割文本 (\\n\\n 分隔符)"""
    
def split_by_sentences(text: str) -> List[str]:
    """按句子分割文本 (句号、问号、感叹号)"""
    
def split_by_commas(text: str) -> List[str]:
    """按逗号分割文本"""
    
def force_split_by_char_limit(text: str, max_chars: int) -> List[str]:
    """强制按字符数切分，用于超长单元"""
    
def smart_chunk_text(text: str, max_chunk_size: int = MAX_CHUNK_CHAR_SIZE) -> List[str]:
    """智能分块：优先段落 > 句子 > 逗号 > 强制切分"""
```

**分块策略**:

1. **优先级顺序**: 段落边界 → 句子边界 → 逗号边界 → 强制字符切分
2. **边界保留**: 保留原始标点符号和空白字符
3. **完整性保证**: 确保所有字符都被包含在某个 chunk 中
4. **大小限制**: 每个 chunk 不超过 `max_chunk_size`

**算法伪代码**:

```
function smart_chunk_text(text, max_size):
    chunks = []
    paragraphs = split_by_paragraphs(text)
    
    for paragraph in paragraphs:
        if len(paragraph) <= max_size:
            chunks.append(paragraph)
        else:
            sentences = split_by_sentences(paragraph)
            for sentence in sentences:
                if len(sentence) <= max_size:
                    chunks.append(sentence)
                else:
                    parts = split_by_commas(sentence)
                    for part in parts:
                        if len(part) <= max_size:
                            chunks.append(part)
                        else:
                            chunks.extend(force_split_by_char_limit(part, max_size))
    
    return chunks
```

---

### 3. CLI Selftest Tool (`kokoro_local/selftest/`)

**目录结构**:
```
kokoro_local/selftest/
├── __init__.py
├── __main__.py       # CLI 入口点
├── config.py         # 配置解析
└── reporter.py       # 报告生成
```

**主要类**:

```python
class SelftestConfig:
    """自检配置"""
    text: str
    speed: float
    device: str
    output_dir: str
    language: str
    
    @classmethod
    def from_yaml(cls, path: str) -> 'SelftestConfig':
        """从 YAML 文件加载配置"""

class SelftestRunner:
    """自检执行器"""
    def __init__(self, config: SelftestConfig):
        pass
        
    def run(self) -> SelftestResult:
        """执行自检并返回结果"""
        
class SelftestResult:
    """自检结果"""
    timestamp: str
    device: str
    chunks: int
    duration_seconds: float
    model_path: str
    wav_size_bytes: int
    total_time_seconds: float
    status: str
    errors: List[str]
    
    def to_json(self) -> str:
        """转换为 JSON 格式"""
        
    def to_markdown(self) -> str:
        """转换为 Markdown 格式"""
```

**CLI 参数**:

```bash
python -m kokoro_local.selftest [OPTIONS]

Options:
  --config PATH          配置文件路径 (默认: configs/default.yaml)
  --format {json,markdown}  输出格式 (默认: json)
  --verbose             详细日志输出
  --help                显示帮助信息
```

**执行流程**:

```
1. 解析命令行参数
2. 加载 YAML 配置文件
3. 初始化 wrapper (通过导入或子进程)
4. 记录开始时间
5. 调用 wrapper.synthesize_audio()
6. 记录结束时间和指标
7. 生成报告 (JSON 或 Markdown)
8. 输出到 stdout
9. 返回退出码 (0=成功, 非0=失败)
```

---

### 4. Configuration Files

**`configs/default.yaml`**:
```yaml
# 默认配置 - CPU 模式
text: "This is a test of the Kokoro TTS system. It should generate clear and natural speech."
speed: 1.0
device: auto
output_dir: public/
language: en-US
voice: af_bella
```

**`configs/gpu.yaml`**:
```yaml
# GPU 配置 - 强制使用 CUDA
text: "GPU acceleration test. This text will be processed using CUDA if available."
speed: 1.0
device: cuda
output_dir: public/
language: en-US
voice: af_bella
```

---

### 5. Legacy Scripts Migration

**迁移策略**:

1. 将以下文件移至 `kokoro_local/legacy/`:
   - `kokoro_wrapper.py`
   - `kokoro_wrapper_real.py`
   - `kokoro_wrapper_offline.py`
   - `kokoro_wrapper_interactive.py`

2. 在每个 legacy 文件顶部添加 deprecated 警告:

```python
"""
⚠️ DEPRECATED: This script has been replaced by kokoro_local/wrapper.py

Please use the new unified wrapper instead:
  - New path: kokoro_local/wrapper.py
  - Documentation: See README.md for migration guide

This file is kept for reference only and will be removed in a future version.
"""

import warnings
warnings.warn(
    "This wrapper is deprecated. Use kokoro_local/wrapper.py instead.",
    DeprecationWarning,
    stacklevel=2
)
```

3. 创建 `kokoro_local/legacy/README.md`:

```markdown
# Legacy Wrappers (Deprecated)

These files have been replaced by the unified `kokoro_local/wrapper.py`.

## Migration Guide

- **Old**: `kokoro_wrapper_offline.py`
- **New**: `kokoro_local/wrapper.py` (always offline)

- **Old**: `kokoro_wrapper.py`
- **New**: `kokoro_local/wrapper.py` (with device auto-detection)

## Why Deprecated?

- Multiple entry points caused code duplication
- Inconsistent behavior across wrappers
- Difficult to maintain and test

## Removal Timeline

These files will be removed in version 2.0.0 (estimated Q2 2025).
```

---

## Data Models

### Request Model

```python
@dataclass
class TTSRequest:
    text: str
    speed: float = 1.0
    lang_code: str = 'a'
    voice: str = 'af_bella'
    
    def validate(self) -> None:
        if not self.text or not self.text.strip():
            raise ValueError("Text cannot be empty")
        if self.speed <= 0 or self.speed > 3.0:
            raise ValueError("Speed must be between 0 and 3.0")
```

### Response Model

```python
@dataclass
class TTSResponse:
    success: bool
    audio_data: Optional[str] = None
    device: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None
    
    def to_json(self) -> str:
        return json.dumps(asdict(self))
```

### Selftest Result Model

```python
@dataclass
class SelftestResult:
    timestamp: str
    device: str
    chunks: int
    duration_seconds: float
    model_path: str
    wav_size_bytes: int
    total_time_seconds: float
    status: str  # "success" | "failure"
    errors: List[str]
```

---

## Error Handling

### Error Categories

1. **Initialization Errors**
   - Model file not found
   - Device not available
   - Invalid configuration

2. **Runtime Errors**
   - Empty text input
   - Audio generation failure
   - Pipeline creation failure

3. **Network Errors** (should never occur in offline mode)
   - Unexpected network access attempt
   - HuggingFace Hub connection

### Error Response Format

```python
{
    "success": false,
    "error": "Model file not found",
    "details": {
        "searched_paths": [
            "/app/kokoro_local/.cache/huggingface/...",
            "kokoro-models/Kokoro-82M/"
        ],
        "suggestion": "Please download the model using: npm run setup-kokoro"
    }
}
```

### Error Handling Strategy



```python
def handle_error(error: Exception, context: str) -> dict:
    """统一错误处理"""
    error_map = {
        FileNotFoundError: "Model file not found",
        ValueError: "Invalid input parameter",
        RuntimeError: "TTS engine error",
        MemoryError: "Insufficient memory"
    }
    
    error_type = type(error)
    message = error_map.get(error_type, "Unknown error")
    
    return {
        "success": False,
        "error": f"{message}: {str(error)}",
        "context": context,
        "traceback": traceback.format_exc() if DEBUG else None
    }
```

---

## Testing Strategy

### Unit Tests

**`tests/unit/kokoro_local/test_text_chunker.py`**:

```python
def test_split_by_paragraphs():
    text = "Para 1.\n\nPara 2.\n\nPara 3."
    chunks = split_by_paragraphs(text)
    assert len(chunks) == 3
    assert chunks[0] == "Para 1."

def test_split_by_sentences():
    text = "Sentence 1. Sentence 2! Sentence 3?"
    chunks = split_by_sentences(text)
    assert len(chunks) == 3

def test_smart_chunk_text_long():
    text = "a" * 1000
    chunks = smart_chunk_text(text, max_chunk_size=100)
    assert all(len(c) <= 100 for c in chunks)
    assert "".join(chunks) == text  # 完整性验证

def test_smart_chunk_text_empty():
    chunks = smart_chunk_text("")
    assert chunks == []

def test_smart_chunk_text_unicode():
    text = "你好世界！这是一个测试。"
    chunks = smart_chunk_text(text)
    assert len(chunks) > 0
```

**`tests/unit/kokoro_local/test_wrapper.py`**:

```python
@pytest.fixture
def mock_model():
    """Mock Kokoro model"""
    pass

def test_setup_device_cuda(monkeypatch):
    monkeypatch.setenv("KOKORO_DEVICE", "cuda")
    service = KokoroTTSService()
    assert service.device == "cuda"

def test_setup_device_auto():
    service = KokoroTTSService()
    assert service.device in ["cpu", "cuda", "mps"]

def test_process_request_empty_text():
    service = KokoroTTSService()
    response = service.process_request('{"text": ""}')
    assert response["success"] is False
    assert "empty" in response["error"].lower()
```

### Integration Tests

**`tests/integration/test_wrapper_integration.py`**:

```python
def test_wrapper_with_text_chunker():
    """验证 wrapper 正确使用 text_chunker"""
    service = KokoroTTSService()
    long_text = "a" * 1000
    response = service.process_request(json.dumps({
        "text": long_text,
        "speed": 1.0
    }))
    assert response["success"] is True

def test_wrapper_offline_mode():
    """验证完全离线运行"""
    # 断开网络或设置环境变量
    os.environ["HF_HUB_OFFLINE"] = "1"
    service = KokoroTTSService()
    response = service.process_request(json.dumps({
        "text": "Test",
        "speed": 1.0
    }))
    assert response["success"] is True
```

### End-to-End Tests

**`tests/e2e/test_nodejs_integration.py`**:

```python
def test_nodejs_service_calls_wrapper():
    """验证 Node.js 服务能正确调用新 wrapper"""
    # 启动 Node.js 服务
    # 发送 API 请求
    # 验证音频生成
    pass

def test_cli_selftest_execution():
    """验证 CLI 自检工具"""
    result = subprocess.run(
        ["python", "-m", "kokoro_local.selftest", "--config", "configs/default.yaml"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0
    output = json.loads(result.stdout)
    assert output["status"] == "success"
```

### Performance Tests

```python
def test_long_text_performance():
    """验证长文本处理性能"""
    text = "Test sentence. " * 1000  # ~15000 chars
    start = time.time()
    service = KokoroTTSService()
    response = service.process_request(json.dumps({"text": text}))
    duration = time.time() - start
    
    assert response["success"] is True
    assert duration < 300  # 5分钟内完成
```

---

## Deployment Considerations

### Environment Variables

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `KOKORO_DEVICE` | `auto` | 设备选择: auto/cpu/cuda/mps |
| `KOKORO_WRAPPER_PATH` | `kokoro_local/wrapper.py` | Wrapper 路径 |
| `KOKORO_PYTHON` | `python3` | Python 解释器路径 |
| `HF_HUB_OFFLINE` | `1` | 强制离线模式 |
| `TRANSFORMERS_OFFLINE` | `1` | Transformers 离线模式 |
| `KOKORO_REPO_PATH` | `kokoro-main-ref` | Kokoro 仓库路径 |
| `PYTORCH_ENABLE_MPS_FALLBACK` | `1` | MPS 回退支持 |

### Model File Locations

**优先级顺序**:

1. `/app/kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main/`
2. `~/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main/`
3. `kokoro-models/Kokoro-82M/`

**必需文件**:
- `kokoro-v1_0.pth` (模型权重, ~330MB)
- `config.json` (模型配置)
- `voices/*.pt` (语音包文件)

### Docker Considerations

**Dockerfile 片段**:

```dockerfile
# 预先复制模型文件
COPY kokoro-models/ /app/kokoro-models/
COPY kokoro_local/.cache/ /app/kokoro_local/.cache/

# 验证模型文件存在
RUN python3 -c "import os; \
    assert os.path.exists('/app/kokoro-models/Kokoro-82M/kokoro-v1_0.pth'), \
    'Model file not found'"

# 设置离线环境变量
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1
ENV KOKORO_DEVICE=auto
```

### CI/CD Integration

**GitHub Actions 示例**:

```yaml
- name: Run TTS Selftest
  run: |
    python -m kokoro_local.selftest \
      --config configs/default.yaml \
      --format json > selftest-report.json
    
- name: Upload Selftest Report
  uses: actions/upload-artifact@v3
  with:
    name: tts-selftest-report
    path: selftest-report.json
```

---

## Migration Path

### Phase 1: Preparation (Week 1)

1. 创建 `kokoro_local/wrapper.py` (合并现有实现)
2. 创建 `kokoro_local/text_chunker.py`
3. 编写单元测试
4. 创建配置文件模板

### Phase 2: Legacy Migration (Week 1-2)

1. 移动 legacy 文件到 `kokoro_local/legacy/`
2. 添加 deprecated 警告
3. 更新 `lib/kokoro-env.ts` 中的路径解析

### Phase 3: CLI Tool (Week 2)

1. 实现 `kokoro_local/selftest/` 模块
2. 创建配置文件
3. 编写集成测试

### Phase 4: Testing & Validation (Week 2-3)

1. 运行完整测试套件
2. 验证离线模式
3. 验证 CPU/GPU 切换
4. 长文本压力测试

### Phase 5: Documentation (Week 3)

1. 更新 README.md
2. 更新协作守则
3. 更新部署指南
4. 创建迁移指南

### Phase 6: Deployment (Week 3-4)

1. 在测试环境验证
2. 在生产环境部署
3. 监控和调优
4. 收集反馈

---

## Performance Optimization

### Chunking Optimization

```python
# 使用缓存避免重复分块
from functools import lru_cache

@lru_cache(maxsize=128)
def smart_chunk_text_cached(text: str, max_chunk_size: int) -> tuple:
    """带缓存的分块函数"""
    chunks = smart_chunk_text(text, max_chunk_size)
    return tuple(chunks)  # 返回 tuple 以支持缓存
```

### Model Loading Optimization

```python
# 延迟加载：仅在首次请求时加载模型
class LazyModelLoader:
    def __init__(self):
        self._model = None
    
    @property
    def model(self):
        if self._model is None:
            self._model = self._load_model()
        return self._model
```

### Parallel Processing

```python
# 对于长文本，并行处理多个 chunk
import asyncio

async def generate_chunks_parallel(chunks: List[str], max_concurrency: int = 2):
    semaphore = asyncio.Semaphore(max_concurrency)
    
    async def process_chunk(chunk):
        async with semaphore:
            return await generate_audio(chunk)
    
    tasks = [process_chunk(c) for c in chunks]
    return await asyncio.gather(*tasks)
```

---

## Security Considerations

### Input Validation

```python
def validate_text_input(text: str) -> None:
    """验证文本输入安全性"""
    if len(text) > 100000:  # 100KB 限制
        raise ValueError("Text too long")
    
    # 检查恶意字符
    forbidden_chars = ['\x00', '\x01', '\x02']
    if any(c in text for c in forbidden_chars):
        raise ValueError("Invalid characters in text")
```

### Path Traversal Prevention

```python
def safe_model_path(path: str) -> Path:
    """防止路径遍历攻击"""
    resolved = Path(path).resolve()
    allowed_dirs = [
        Path("/app/kokoro-models").resolve(),
        Path.home() / ".cache" / "huggingface"
    ]
    
    if not any(resolved.is_relative_to(d) for d in allowed_dirs):
        raise ValueError("Invalid model path")
    
    return resolved
```

### Resource Limits

```python
# 限制并发请求数
MAX_CONCURRENT_REQUESTS = 5
request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# 限制单次音频生成时长
GENERATION_TIMEOUT = 300  # 5分钟
```

---

## Monitoring and Observability

### Logging Strategy

```python
import logging

logger = logging.getLogger("kokoro_tts")
logger.setLevel(logging.INFO)

# 关键事件日志
logger.info("Model loaded", extra={
    "model_path": model_path,
    "device": device,
    "load_time_ms": load_time
})

logger.info("Audio generated", extra={
    "text_length": len(text),
    "chunks": num_chunks,
    "duration_seconds": duration,
    "device": device
})
```

### Metrics Collection

```python
@dataclass
class TTSMetrics:
    """TTS 性能指标"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    avg_generation_time: float = 0.0
    avg_text_length: float = 0.0
    avg_audio_duration: float = 0.0
    
    def record_request(self, success: bool, gen_time: float, text_len: int, audio_dur: float):
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
        
        # 更新平均值
        n = self.total_requests
        self.avg_generation_time = (self.avg_generation_time * (n-1) + gen_time) / n
        self.avg_text_length = (self.avg_text_length * (n-1) + text_len) / n
        self.avg_audio_duration = (self.avg_audio_duration * (n-1) + audio_dur) / n
```

---

## Rollback Plan

如果重构后出现严重问题，回滚步骤：

1. **恢复 Node.js 配置**:
   ```typescript
   // lib/kokoro-env.ts
   const DEFAULT_WRAPPER_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'kokoro_wrapper_offline.py')
   ```

2. **从 legacy 目录恢复文件**:
   ```bash
   cp kokoro_local/legacy/kokoro_wrapper_offline.py kokoro_local/
   ```

3. **回滚环境变量**:
   ```bash
   export KOKORO_WRAPPER_PATH=kokoro_local/kokoro_wrapper_offline.py
   ```

4. **重启服务**:
   ```bash
   npm run build
   npm run start
   ```

---

## Future Enhancements

### Potential Improvements (Out of Scope for v1.0)

1. **流式音频生成**: 实时返回音频块而非等待全部完成
2. **音频缓存**: 缓存常见文本的音频结果
3. **多语言并行**: 同时支持多种语言的 pipeline
4. **自适应分块**: 根据模型性能动态调整 chunk 大小
5. **WebSocket 支持**: 替代 stdin/stdout 的实时通信
6. **分布式处理**: 多机器并行处理长文本

---

## Appendix

### A. File Structure After Refactoring

```
kokoro_local/
├── wrapper.py                    # 新的统一入口
├── text_chunker.py               # 分块模块
├── selftest/
│   ├── __init__.py
│   ├── __main__.py
│   ├── config.py
│   └── reporter.py
├── legacy/                       # 废弃文件
│   ├── README.md
│   ├── kokoro_wrapper.py
│   ├── kokoro_wrapper_real.py
│   ├── kokoro_wrapper_offline.py
│   └── kokoro_wrapper_interactive.py
├── voices/                       # 语音包
│   └── *.pt
└── requirements.txt

configs/
├── default.yaml
└── gpu.yaml
```

### B. Dependencies

**Python 依赖** (`kokoro_local/requirements.txt`):
```
torch>=2.0.0
numpy>=1.24.0
scipy>=1.10.0
soundfile>=0.12.0
pyyaml>=6.0
```

**Node.js 依赖**: 无新增

### C. Glossary

- **Wrapper**: TTS 引擎的入口脚本
- **Pipeline**: Kokoro 的音频生成流水线
- **Chunk**: 文本分块，用于处理长文本
- **Voice Pack**: 语音包文件 (.pt)
- **Offline Mode**: 离线模式，不访问网络
- **Selftest**: 自检工具，用于验证系统配置

---

## Summary

本设计文档详细描述了 Kokoro TTS 模块重构的技术方案，包括：

- **统一架构**: 单一 wrapper 入口，消除代码分裂
- **模块化设计**: 独立的分块模块和 CLI 工具
- **离线优先**: 强制本地模型加载，无网络依赖
- **完整测试**: 单元、集成、端到端测试覆盖
- **平滑迁移**: 向后兼容，分阶段实施
- **可观测性**: 详细日志和性能指标

设计遵循 SOLID 原则，确保代码可维护、可测试、可扩展。
