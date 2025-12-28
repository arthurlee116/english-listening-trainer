#!/bin/bash
# Kokoro TTS Setup - CoreML 版本 (Apple Silicon)
# 仅保留 CoreML 路线：必须成功导出并加载 CoreML 模型
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KOKORO_DIR="$PROJECT_ROOT/kokoro_local"
VENV_DIR="$KOKORO_DIR/venv"
VOICES_DIR="$KOKORO_DIR/voices"
COREML_DIR="$KOKORO_DIR/coreml"

log_info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$1"; }
log_error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"; }
log_success() { printf "\033[1;32m[SUCCESS]\033[0m %s\n" "$1"; }
log_warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$1"; }

# 验证 Apple Silicon
if [[ "$(uname -s)" != "Darwin" ]]; then
  log_error "This script is for macOS only (MPS/CoreML requires Apple Silicon)"
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  log_error "MPS/CoreML requires Apple Silicon (arm64). Detected: $(uname -m)"
  exit 1
fi

log_success "Apple Silicon detected ✓"

# 代理设置 (如果需要)
if [[ -z "${http_proxy:-}" ]]; then
  export http_proxy="http://127.0.0.1:10808"
  export https_proxy="http://127.0.0.1:10808"
  log_info "Using proxy: 127.0.0.1:10808"
fi

# Python 检查 (需要 3.10-3.12，Kokoro 不支持 3.13)
PYTHON_BIN="${KOKORO_PYTHON:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  for py in python3.12 python3.11 python3.10; do
    if command -v "$py" >/dev/null 2>&1; then
      PYTHON_BIN="$py"
      break
    fi
  done
fi

if [[ -z "$PYTHON_BIN" ]] || ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  log_error "Python 3.10-3.12 required. Install: brew install python@3.12"
  exit 1
fi

PYTHON_VERSION="$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
log_info "Using Python $PYTHON_VERSION ($PYTHON_BIN)"

# 创建目录
mkdir -p "$VOICES_DIR" "$PROJECT_ROOT/public/audio" "$COREML_DIR"

# 虚拟环境
if [[ ! -d "$VENV_DIR" ]]; then
  log_info "Creating virtual environment..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q

# 安装 PyTorch（Kokoro 特征提取需要）
if ! python -c "import torch" 2>/dev/null; then
  log_info "Installing PyTorch..."
  pip install torch torchaudio -q
fi

# 安装基础依赖
log_info "Installing base dependencies..."
pip install -r "$KOKORO_DIR/requirements.txt" -q

# 安装 CoreML 依赖
log_info "Installing CoreML dependencies..."
if [[ -f "$KOKORO_DIR/requirements-coreml.txt" ]]; then
  pip install -r "$KOKORO_DIR/requirements-coreml.txt" -q
else
  pip install coremltools>=8.0.0 -q
fi

# 验证 CoreML
log_info "Verifying CoreML..."
python - <<'PY'
import coremltools as ct
print(f"✅ coremltools {ct.__version__} ready")
PY

# 复制语音文件
VOICE_SOURCE="${KOKORO_VOICE_SOURCE:-$PROJECT_ROOT/kokoro-main-ref/kokoro.js/voices}"
if [[ -f "$VOICE_SOURCE/af_heart.pt" && ! -f "$VOICES_DIR/af_heart.pt" ]]; then
  cp "$VOICE_SOURCE/af_heart.pt" "$VOICES_DIR/"
  log_success "Voice file copied"
fi

# 导出 CoreML 模型（必需）
log_info "Exporting CoreML models (required)..."
if [[ -f "$PROJECT_ROOT/scripts/export_coreml.py" ]]; then
  python "$PROJECT_ROOT/scripts/export_coreml.py" --output_dir "$COREML_DIR"
else
  log_error "CoreML export script not found: scripts/export_coreml.py"
  exit 1
fi

# 验证 CoreML wrapper 和导出的模型
if [[ ! -f "$KOKORO_DIR/kokoro_coreml_wrapper.py" ]]; then
  log_error "CoreML wrapper not found: kokoro_local/kokoro_coreml_wrapper.py"
  exit 1
fi

if ! ls "$COREML_DIR"/*.mlpackage >/dev/null 2>&1; then
  log_error "No CoreML models found under: $COREML_DIR"
  log_error "Re-run: python scripts/export_coreml.py --output_dir kokoro_local/coreml"
  exit 1
fi

log_success "CoreML wrapper + models ready"

log_success "Kokoro TTS (CoreML + ANE) setup complete!"
log_info ""
log_info "Performance optimizations enabled:"
log_info "  - CoreML acceleration (macOS)"
log_info "  - Float16 precision"
log_info "  - Increased chunk size (300 chars)"
log_info "  - Model warmup"
log_info ""
log_info "Run 'npm run dev' to start the application"
