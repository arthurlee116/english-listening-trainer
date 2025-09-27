#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_VENV="${PROJECT_ROOT}/kokoro-local/venv"
DEFAULT_PYTHON="${PYTHON_BIN:-python3}"
DEFAULT_TORCH_VERSION="${TORCH_VERSION:-2.3.0}"
DEFAULT_TORCHAUDIO_VERSION="${TORCHAUDIO_VERSION:-2.3.0}"
DEFAULT_TORCHVISION_VERSION="${TORCHVISION_VERSION:-0.18.0}"
DEFAULT_CUDA="${CUDA_VERSION:-12.1}"
FORCE_RECREATE=false
DEVICE_OVERRIDE="${KOKORO_DEVICE:-}" # respects existing env override

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --python PATH           Python interpreter to use (default: ${DEFAULT_PYTHON})
  --venv PATH             Virtualenv path (default: ${DEFAULT_VENV})
  --cuda-version VERSION  Target CUDA runtime (default: ${DEFAULT_CUDA})
  --torch VERSION         Torch version (default: ${DEFAULT_TORCH_VERSION})
  --torchaudio VERSION    Torchaudio version (default: ${DEFAULT_TORCHAUDIO_VERSION})
  --torchvision VERSION   Torchvision version (default: ${DEFAULT_TORCHVISION_VERSION})
  --device (cuda|cpu|mps) Force install mode (auto by default)
  --recreate              Recreate the virtualenv even if it exists
  -h, --help              Show this message
USAGE
}

PYTHON_BIN="${DEFAULT_PYTHON}"
VENV_PATH="${DEFAULT_VENV}"
CUDA_VERSION="${DEFAULT_CUDA}"
TORCH_VERSION="${DEFAULT_TORCH_VERSION}"
TORCHAUDIO_VERSION="${DEFAULT_TORCHAUDIO_VERSION}"
TORCHVISION_VERSION="${DEFAULT_TORCHVISION_VERSION}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --python)
      PYTHON_BIN="$2"; shift 2 ;;
    --venv)
      VENV_PATH="$2"; shift 2 ;;
    --cuda-version)
      CUDA_VERSION="$2"; shift 2 ;;
    --torch)
      TORCH_VERSION="$2"; shift 2 ;;
    --torchaudio)
      TORCHAUDIO_VERSION="$2"; shift 2 ;;
    --torchvision)
      TORCHVISION_VERSION="$2"; shift 2 ;;
    --device)
      DEVICE_OVERRIDE="$2"; shift 2 ;;
    --recreate)
      FORCE_RECREATE=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

log() { printf '[INFO] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
error_exit() { printf '[ERROR] %s\n' "$1" >&2; exit 1; }

log "Project root: ${PROJECT_ROOT}"
log "Virtualenv path: ${VENV_PATH}"

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  error_exit "Python interpreter '${PYTHON_BIN}' not found"
fi

PYTHON_VERSION_RAW="$(${PYTHON_BIN} --version 2>&1)"
log "Using Python: ${PYTHON_VERSION_RAW}"

MAJOR="$(${PYTHON_BIN} - <<'PY'
import sys
print(sys.version_info.major)
PY
)"
MINOR="$(${PYTHON_BIN} - <<'PY'
import sys
print(sys.version_info.minor)
PY
)"

if [[ ${MAJOR} -ne 3 || ${MINOR} -lt 8 || ${MINOR} -gt 12 ]]; then
  error_exit "Kokoro requires Python 3.8–3.12; detected ${PYTHON_VERSION_RAW}"
fi

if [[ "${DEVICE_OVERRIDE}" == "" ]]; then
  if [[ "${OSTYPE}" == "darwin"* ]]; then
    if [[ "$(uname -m)" == "arm64" ]]; then
      DEVICE_MODE="mps"
    else
      DEVICE_MODE="cpu"
    fi
  elif command -v nvidia-smi >/dev/null 2>&1; then
    DEVICE_MODE="cuda"
  else
    DEVICE_MODE="cpu"
  fi
else
  DEVICE_MODE="${DEVICE_OVERRIDE}"
fi

log "Installation mode: ${DEVICE_MODE}"

if [[ -d "${VENV_PATH}" && ${FORCE_RECREATE} == false ]]; then
  log "Virtualenv exists"
else
  [[ ${FORCE_RECREATE} == true ]] && rm -rf "${VENV_PATH}"
  log "Creating virtualenv"
  "${PYTHON_BIN}" -m venv "${VENV_PATH}"
fi

# shellcheck disable=SC1090
source "${VENV_PATH}/bin/activate"

pip install --upgrade pip setuptools wheel >/dev/null

function torch_ok() {
  python - <<'PY'
import json
import torch
cuda_runtime = torch.version.cuda or ''
is_available = torch.cuda.is_available()
print(json.dumps({
    "torch": torch.__version__,
    "cuda": cuda_runtime,
    "available": is_available,
}))
PY
}

CURRENT_STATE=""
set +e
CURRENT_STATE="$(torch_ok 2>/dev/null)"
TORCH_STATUS=$?
set -e

if [[ ${TORCH_STATUS} -eq 0 ]]; then
  log "Current torch state: ${CURRENT_STATE}"
fi

install_cuda_packages() {
  local suffix
  case "${CUDA_VERSION}" in
    11.8|11.8.*) suffix="cu118" ;;
    12.0|12.0.*) suffix="cu120" ;;
    12.1|12.1.*) suffix="cu121" ;;
    12.2|12.2.*) suffix="cu122" ;;
    12.3|12.3.*) suffix="cu123" ;;
    12.4|12.4.*) suffix="cu124" ;;
    *) suffix="cu121"; warn "Unknown CUDA version ${CUDA_VERSION}, defaulting to cu121" ;;
  esac
  local index="https://download.pytorch.org/whl/${suffix}"
  log "Installing CUDA packages (suffix ${suffix})"
  pip install --no-cache-dir --extra-index-url "${index}" \
    "torch==${TORCH_VERSION}+${suffix}" \
    "torchaudio==${TORCHAUDIO_VERSION}+${suffix}" \
    "torchvision==${TORCHVISION_VERSION}+${suffix}"
}

install_cpu_packages() {
  local index="https://download.pytorch.org/whl/cpu"
  log "Installing CPU/MPS packages"
  pip install --no-cache-dir --extra-index-url "${index}" \
    "torch==${TORCH_VERSION}" \
    "torchaudio==${TORCHAUDIO_VERSION}" \
    "torchvision==${TORCHVISION_VERSION}"
}

if [[ ${DEVICE_MODE} == "cuda" ]]; then
  install_cuda_packages
else
  install_cpu_packages
fi

pip install --no-cache-dir -r "${PROJECT_ROOT}/kokoro-local/requirements.txt"

FINAL_STATE="$(torch_ok)"
log "Final torch state: ${FINAL_STATE}"

if [[ ${DEVICE_MODE} == "cuda" && ${FINAL_STATE} != *'"available": true'* ]]; then
  warn "torch.cuda.is_available() returned false after installation. Verify drivers and CUDA toolkit."
  exit 2
fi

log "PyTorch installation completed"
