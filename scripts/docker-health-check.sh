#!/bin/bash
# Docker 容器健康检查脚本
# 用于验证容器内服务和 GPU 的可用性

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# 检查 Next.js 服务
check_nextjs() {
  log_info "检查 Next.js 服务..."
  
  if ! curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    log_error "Next.js 服务不可用"
    return 1
  fi
  
  log_info "Next.js 服务正常"
  return 0
}

# 检查 GPU 可用性
check_gpu() {
  if [ "${KOKORO_DEVICE:-}" != "cuda" ]; then
    log_info "跳过 GPU 检查（KOKORO_DEVICE=${KOKORO_DEVICE:-cpu}）"
    return 0
  fi
  
  log_info "检查 GPU 可用性..."
  
  # 检查 nvidia-smi
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    log_warn "nvidia-smi 不可用"
    return 0
  fi
  
  if ! nvidia-smi >/dev/null 2>&1; then
    log_error "nvidia-smi 执行失败"
    return 1
  fi
  
  # 检查 PyTorch CUDA
  if ! python3 -c "import torch; assert torch.cuda.is_available()" 2>/dev/null; then
    log_error "PyTorch CUDA 不可用"
    return 1
  fi
  
  log_info "GPU 可用"
  return 0
}

# 检查 Python 环境
check_python() {
  log_info "检查 Python 环境..."
  
  if ! python3 --version >/dev/null 2>&1; then
    log_error "Python 不可用"
    return 1
  fi
  
  # 检查虚拟环境
  if [ -n "${KOKORO_VENV:-}" ] && [ -d "${KOKORO_VENV}" ]; then
    if [ ! -f "${KOKORO_VENV}/bin/python" ]; then
      log_error "Python 虚拟环境损坏"
      return 1
    fi
  fi
  
  log_info "Python 环境正常"
  return 0
}

# 检查必需的依赖
check_dependencies() {
  log_info "检查必需依赖..."
  
  local missing_deps=()
  
  # 检查 espeak-ng
  if ! command -v espeak-ng >/dev/null 2>&1; then
    missing_deps+=("espeak-ng")
  fi
  
  # 检查 curl
  if ! command -v curl >/dev/null 2>&1; then
    missing_deps+=("curl")
  fi
  
  if [ ${#missing_deps[@]} -gt 0 ]; then
    log_error "缺少依赖: ${missing_deps[*]}"
    return 1
  fi
  
  log_info "所有依赖已安装"
  return 0
}

# 检查磁盘空间
check_disk_space() {
  log_info "检查磁盘空间..."
  
  local available_mb=$(df /app | tail -1 | awk '{print int($4/1024)}')
  local min_required_mb=1024  # 至少 1GB
  
  if [ "$available_mb" -lt "$min_required_mb" ]; then
    log_warn "磁盘空间不足: ${available_mb}MB 可用（建议至少 ${min_required_mb}MB）"
    return 0  # 警告但不失败
  fi
  
  log_info "磁盘空间充足: ${available_mb}MB 可用"
  return 0
}

# 主函数
main() {
  echo "=========================================="
  echo "Docker 容器健康检查"
  echo "=========================================="
  
  local failed=0
  
  # 执行所有检查
  check_nextjs || failed=$((failed + 1))
  check_python || failed=$((failed + 1))
  check_dependencies || failed=$((failed + 1))
  check_gpu || failed=$((failed + 1))
  check_disk_space || true  # 磁盘空间检查不影响健康状态
  
  echo "=========================================="
  
  if [ $failed -eq 0 ]; then
    log_info "所有健康检查通过"
    exit 0
  else
    log_error "$failed 项检查失败"
    exit 1
  fi
}

# 运行主函数
main "$@"
