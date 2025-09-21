#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KOKORO_DIR="$PROJECT_ROOT/kokoro-local"
VOICES_DIR="$KOKORO_DIR/voices"
DEFAULT_VOICE_SOURCE="$PROJECT_ROOT/kokoro-main-ref/kokoro.js/voices"
PYTHON_BIN="${KOKORO_PYTHON:-python3}"
TORCH_VARIANT="${KOKORO_TORCH_VARIANT:-auto}"
TORCH_INDEX_URL="${KOKORO_TORCH_INDEX_URL:-}"
TORCH_PACKAGES="${KOKORO_TORCH_PACKAGES:-torch torchaudio torchvision}"

log_info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$1"; }
log_warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$1"; }
log_error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"; }
log_success() { printf "\033[1;32m[SUCCESS]\033[0m %s\n" "$1"; }

log_info "Preparing Kokoro TTS environment"

# Ensure python is available
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  log_error "Python executable '$PYTHON_BIN' not found. Set KOKORO_PYTHON to a valid interpreter."
  exit 1
fi

PYTHON_VERSION="$($PYTHON_BIN --version 2>&1)"
log_info "Using $PYTHON_VERSION"

# Create directories
mkdir -p "$VOICES_DIR" "$PROJECT_ROOT/public/audio"

# Resolve voice source directory
VOICE_SOURCE="${KOKORO_VOICE_SOURCE:-$DEFAULT_VOICE_SOURCE}"
VOICE_TARGET_BASENAME="af_heart"
VOICE_FOUND=false
for extension in pt bin; do
  TARGET_FILE="$VOICES_DIR/${VOICE_TARGET_BASENAME}.${extension}"
  if [[ -f "$TARGET_FILE" ]]; then
    log_success "Voice file '$VOICE_TARGET_BASENAME.$extension' already present"
    VOICE_FOUND=true
    break
  fi

  SOURCE_FILE="$VOICE_SOURCE/${VOICE_TARGET_BASENAME}.${extension}"
  if [[ -f "$SOURCE_FILE" ]]; then
    cp "$SOURCE_FILE" "$TARGET_FILE"
    log_success "Copied voice file '$VOICE_TARGET_BASENAME.$extension'"
    VOICE_FOUND=true
    break
  fi

done

if [[ "$VOICE_FOUND" = false ]]; then
  log_warn "Voice file '$VOICE_TARGET_BASENAME.(pt|bin)' not found. Set KOKORO_VOICE_SOURCE to a directory containing Kokoro voices."
fi

# espeak-ng detection (optional but recommended)
if ! command -v espeak-ng >/dev/null 2>&1; then
  log_warn "espeak-ng not found. Install it via 'brew install espeak-ng' (macOS) or 'sudo apt install espeak-ng' (Ubuntu)."
else
  log_success "espeak-ng detected"
fi

# Setup virtual environment
cd "$KOKORO_DIR"

if [[ ! -d venv ]]; then
  log_info "Creating Python virtual environment"
  "$PYTHON_BIN" -m venv venv
  log_success "Virtual environment created"
fi

# shellcheck disable=SC1091
source venv/bin/activate

pip install --upgrade pip

# Determine torch variant when auto
if [[ "$TORCH_VARIANT" == "auto" ]]; then
  if [[ "${KOKORO_DEVICE:-}" == "cuda" ]]; then
    TORCH_VARIANT="cuda"
  elif command -v nvidia-smi >/dev/null 2>&1; then
    TORCH_VARIANT="cuda"
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    TORCH_VARIANT="mps"
  else
    TORCH_VARIANT="cpu"
  fi
fi

log_info "Installing PyTorch variant: $TORCH_VARIANT"

if python -c "import torch" >/dev/null 2>&1; then
  log_info "PyTorch already installed in virtual environment"
else
  case "$TORCH_VARIANT" in
    cuda)
      INDEX="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu118}"
      pip install --index-url "$INDEX" $TORCH_PACKAGES
      ;;
    mps)
      INDEX="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cpu}"
      pip install --index-url "$INDEX" $TORCH_PACKAGES
      ;;
    cpu|*)
      INDEX="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cpu}"
      pip install --index-url "$INDEX" $TORCH_PACKAGES
      ;;
  esac
fi

pip install -r requirements.txt

log_info "Verifying installation"
python - <<'PY'
import os
import torch
import soundfile
import numpy

print(f"PyTorch {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"MPS available: {getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available()}")
print(f"soundfile {soundfile.__version__}")
print(f"numpy {numpy.__version__}")
PY

log_success "Kokoro TTS setup complete"
log_info "If you need to adjust CUDA or proxy settings, export KOKORO_CUDA_HOME, KOKORO_HTTP_PROXY, or related env vars before running this script."
