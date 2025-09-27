#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${1:-${PYTHON_BIN:-python3}}"

info() { printf '[INFO] %s\n' "$1"; }
success() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
error_msg() { printf '[ERROR] %s\n' "$1" >&2; }

info "Running GPU environment diagnostics"
info "Project root: ${PROJECT_ROOT}"

OS_NAME="$(uname -s)"
info "Detected platform: ${OS_NAME}"

GPU_FOUND=false
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_FOUND=true
  info "nvidia-smi detected"
  nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader || warn "Unable to query GPU details"
else
  warn "nvidia-smi not found. GPU drivers or NVIDIA Container Toolkit are missing."
  warn "Install NVIDIA drivers >= 525 and the container toolkit:"
  warn "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html"
fi

if [[ "${GPU_FOUND}" != true ]]; then
  warn "Falling back to CPU/MPS mode. Set KOKORO_DEVICE=cpu for container deployments without CUDA."
fi

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  error_msg "Python interpreter '${PYTHON_BIN}' not found. Pass an interpreter with: $0 /path/to/python"
  exit 2
fi

info "Using Python: ${PYTHON_BIN} ($(${PYTHON_BIN} --version 2>&1))"

PY_RESULT="$(${PYTHON_BIN} - <<'PY'
import json
import sys
try:
    import torch
    cuda_available = torch.cuda.is_available()
    cuda_version = torch.version.cuda or 'unknown'
    cudnn_version = torch.backends.cudnn.version() if torch.backends.cudnn.is_available() else None
    device_name = torch.cuda.get_device_name(0) if cuda_available else None
    result = {
        "torch_version": torch.__version__,
        "cuda_available": cuda_available,
        "cuda_runtime": cuda_version,
        "cudnn_version": cudnn_version,
        "device_name": device_name,
    }
    print(json.dumps(result))
except Exception as exc:
    print(json.dumps({"error": str(exc.__class__.__name__), "message": str(exc)}))
    sys.exit(3)
PY
)"
PY_EXIT=$?

if [[ ${PY_EXIT} -ne 0 ]]; then
  error_msg "Python failed to import torch."
  warn "Install CUDA-enabled PyTorch via scripts/install-pytorch-gpu.sh or rerun npm run setup-kokoro."
  exit 3
fi

if [[ "${PY_RESULT}" == *"error"* ]]; then
  error_msg "Torch diagnostic returned: ${PY_RESULT}"
  warn "Call scripts/install-pytorch-gpu.sh to provision the virtual environment."
  exit 4
fi

info "Torch status: ${PY_RESULT}"

if [[ "${PY_RESULT}" == *'"cuda_available": true'* ]]; then
  success "CUDA runtime detected by torch"
else
  if [[ "${GPU_FOUND}" == true ]]; then
    warn "GPU present but torch.cuda.is_available() returned false. Ensure torch build matches installed CUDA runtime."
    warn "Use scripts/install-pytorch-gpu.sh --cuda-version 12.1 to reinstall dependencies."
    exit 5
  else
    warn "Running in CPU/MPS mode. This is expected on Apple Silicon or CPU-only hosts."
  fi
fi

success "GPU diagnostics finished"
