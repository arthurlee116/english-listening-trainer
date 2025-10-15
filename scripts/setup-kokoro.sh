#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KOKORO_DIR="$PROJECT_ROOT/kokoro-local"
VOICES_DIR="$KOKORO_DIR/voices"
VENV_DIR="${KOKORO_VENV_DIR:-$KOKORO_DIR/venv}"

DEFAULT_VOICE_SOURCE="$PROJECT_ROOT/kokoro-main-ref/kokoro.js/voices"
PYTHON_BIN="${KOKORO_PYTHON:-python3}"
TORCH_VARIANT="${KOKORO_TORCH_VARIANT:-auto}"
TORCH_INDEX_URL="${KOKORO_TORCH_INDEX_URL:-}"
TORCH_PACKAGES="${KOKORO_TORCH_PACKAGES:-torch torchaudio torchvision}"
TORCH_PASCAL_BUILD="${KOKORO_FORCE_PASCAL_BUILD:-0}"

log_info() { printf "\033[1;34m[INFO]\033[0m %s\n" "$1"; }
log_warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$1"; }
log_error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"; }
log_success() { printf "\033[1;32m[SUCCESS]\033[0m %s\n" "$1"; }

log_info "Preparing Kokoro TTS environment"
log_info "Virtualenv target: $VENV_DIR"

# Ensure python is available
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  log_error "Python executable '$PYTHON_BIN' not found. Set KOKORO_PYTHON to a valid interpreter."
  exit 1
fi

PYTHON_VERSION_RAW="$($PYTHON_BIN --version 2>&1)"
PYTHON_VERSION_NUM="$($PYTHON_BIN - <<'PY'
import sys
print('.'.join(str(part) for part in sys.version_info[:3]))
PY
)"

log_info "Using $PYTHON_VERSION_RAW"

PY_MAJOR="${PYTHON_VERSION_NUM%%.*}"
PY_MINOR_TMP="${PYTHON_VERSION_NUM#*.}"
PY_MINOR="${PY_MINOR_TMP%%.*}"

if [[ "$PY_MAJOR" != "3" || "$PY_MINOR" -lt 8 || "$PY_MINOR" -gt 12 ]]; then
  if command -v python3.12 >/dev/null 2>&1; then
    log_warn "Python $PYTHON_VERSION_NUM not supported; switching to python3.12"
    PYTHON_BIN="${KOKORO_PYTHON:-python3.12}"
    PYTHON_VERSION_RAW="$($PYTHON_BIN --version 2>&1)"
    PYTHON_VERSION_NUM="$($PYTHON_BIN - <<'PY'
import sys
print('.'.join(str(part) for part in sys.version_info[:3]))
PY
)"
    log_info "Using $PYTHON_VERSION_RAW"
    PY_MAJOR="${PYTHON_VERSION_NUM%%.*}"
    PY_MINOR_TMP="${PYTHON_VERSION_NUM#*.}"
    PY_MINOR="${PY_MINOR_TMP%%.*}"
  fi
fi

if [[ "$PY_MAJOR" != "3" || "$PY_MINOR" -lt 8 || "$PY_MINOR" -gt 12 ]]; then
  log_error "Kokoro TTS requires Python 3.8–3.12 (detected $PYTHON_VERSION_NUM). Set KOKORO_PYTHON to a compatible interpreter."
  exit 1
fi

if [[ -z "${SSL_CERT_FILE:-}" ]]; then
  DEFAULT_SSL_CERT="$($PYTHON_BIN - <<'PY'
import ssl
path = ssl.get_default_verify_paths().openssl_cafile or ''
print(path)
PY
)"
  if [[ -n "$DEFAULT_SSL_CERT" && -f "$DEFAULT_SSL_CERT" ]]; then
    export SSL_CERT_FILE="$DEFAULT_SSL_CERT"
  fi
fi

if [[ -z "${REQUESTS_CA_BUNDLE:-}" && -n "${SSL_CERT_FILE:-}" ]]; then
  export REQUESTS_CA_BUNDLE="$SSL_CERT_FILE"
fi

if [[ -d "$VENV_DIR" ]]; then
  if [[ -x "$VENV_DIR/bin/python" ]]; then
    EXISTING_VENV_VERSION="$($VENV_DIR/bin/python - <<'PY'
import sys
print('.'.join(str(part) for part in sys.version_info[:3]))
PY
    2>/dev/null || echo "")"
    if [[ "$EXISTING_VENV_VERSION" != "$PYTHON_VERSION_NUM" ]]; then
      log_warn "Existing virtualenv uses Python $EXISTING_VENV_VERSION; removing to rebuild with $PYTHON_VERSION_NUM"
      rm -rf "$VENV_DIR"
    fi
  else
    log_warn "Existing virtualenv is missing python executable; removing"
    rm -rf "$VENV_DIR"
  fi
fi

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

if [[ ! -d "$VENV_DIR" ]]; then
  log_info "Creating Python virtual environment"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  log_success "Virtual environment created"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

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
      if [[ "$TORCH_PASCAL_BUILD" == "1" ]]; then
        TORCH_REPO="${KOKORO_TORCH_REPO:-https://github.com/pytorch/pytorch.git}"
        TORCH_REF="${KOKORO_TORCH_REF:-v2.3.0}"
        TORCHVISION_REPO="${KOKORO_TORCHVISION_REPO:-https://github.com/pytorch/vision.git}"
        TORCHVISION_REF="${KOKORO_TORCHVISION_REF:-v0.18.0}"
        TORCHAUDIO_REPO="${KOKORO_TORCHAUDIO_REPO:-https://github.com/pytorch/audio.git}"
        TORCHAUDIO_REF="${KOKORO_TORCHAUDIO_REF:-v2.3.0}"
        export TORCH_CUDA_ARCH_LIST="${TORCH_CUDA_ARCH_LIST:-6.1;7.0;7.5;8.0;8.6;9.0}"
        export USE_CUDA=1
        export USE_CUDNN=1
        export BUILD_TEST=0
        export USE_IBVERBS=0
        export MAX_JOBS="${MAX_JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 8)}"
        export PYTORCH_BUILD_VERSION="${KOKORO_TORCH_VERSION_OVERRIDE:-2.3.0}"
        export PYTORCH_BUILD_NUMBER="${KOKORO_TORCH_BUILD_NUMBER:-1}"

        clone_and_build() {
          local repo="$1"
          local ref="$2"
          local name="$3"
          local tmp_dir
          tmp_dir="$(mktemp -d)"
          log_info "Cloning $name ($ref)"
          git clone --branch "$ref" --depth 1 "$repo" "$tmp_dir"
          if [[ "$name" == "pytorch" ]]; then
            (cd "$tmp_dir" && git submodule sync && git submodule update --init --recursive)
            (cd "$tmp_dir" && pip install --no-cache-dir -r requirements.txt)
          fi
          log_info "Building $name from source (this can take a while)..."
        pip install --no-cache-dir --no-deps "$tmp_dir"
          rm -rf "$tmp_dir"
        }

        clone_and_build "$TORCH_REPO" "$TORCH_REF" "pytorch"
        clone_and_build "$TORCHVISION_REPO" "$TORCHVISION_REF" "torchvision"
        clone_and_build "$TORCHAUDIO_REPO" "$TORCHAUDIO_REF" "torchaudio"

        python - <<'PY'
import sys
import torch
arches = torch.cuda.get_arch_list()
print(f"Detected CUDA arches: {arches}")
if "sm_61" not in arches:
    sys.exit("PyTorch build is missing sm_61 kernels required for Pascal GPUs.")
PY
      else
        INDEX="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu121}"
        pip install --index-url "$INDEX" $TORCH_PACKAGES
      fi
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
