#!/bin/bash
# Kokoro TTS Setup - MPS 专用版本 (Apple Silicon M4)
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KOKORO_DIR="$PROJECT_ROOT/kokoro_local"
VENV_DIR="$KOKORO_DIR/venv"
VOICES_DIR="$KOKORO_DIR/voices"

log_info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$1"; }
log_error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"; }
log_success() { printf "\033[1;32m[SUCCESS]\033[0m %s\n" "$1"; }

# 验证 Apple Silicon
if [[ "$(uname -s)" != "Darwin" ]]; then
  log_error "This script is for macOS only (MPS requires Apple Silicon)"
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  log_error "MPS requires Apple Silicon (arm64). Detected: $(uname -m)"
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
mkdir -p "$VOICES_DIR" "$PROJECT_ROOT/public/audio"

# 虚拟环境
if [[ ! -d "$VENV_DIR" ]]; then
  log_info "Creating virtual environment..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q

# 安装 PyTorch (MPS 版本)
if ! python -c "import torch" 2>/dev/null; then
  log_info "Installing PyTorch with MPS support..."
  pip install torch torchaudio -q
fi

# 安装依赖
pip install -r "$KOKORO_DIR/requirements.txt" -q

# 验证 MPS
log_info "Verifying MPS..."
python - <<'PY'
import torch
assert torch.backends.mps.is_available(), "MPS not available"
assert torch.backends.mps.is_built(), "PyTorch not built with MPS"

# 简单测试
x = torch.randn(100, 100, device='mps')
y = x @ x.T
torch.mps.synchronize()

print(f"✅ PyTorch {torch.__version__} with MPS ready")
print(f"✅ MPS test passed")
PY

# 复制语音文件
VOICE_SOURCE="${KOKORO_VOICE_SOURCE:-$PROJECT_ROOT/kokoro-main-ref/kokoro.js/voices}"
if [[ -f "$VOICE_SOURCE/af_heart.pt" && ! -f "$VOICES_DIR/af_heart.pt" ]]; then
  cp "$VOICE_SOURCE/af_heart.pt" "$VOICES_DIR/"
  log_success "Voice file copied"
fi

log_success "Kokoro TTS (MPS) setup complete!"
log_info "Run 'npm run dev' to start the application"
