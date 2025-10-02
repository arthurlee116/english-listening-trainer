#!/usr/bin/env bash
# 测试远程服务器连接和环境
# 用于调试部署问题

set -e

# 配置
REMOTE_HOST="${1:-49.234.30.246}"
REMOTE_PORT="${2:-60022}"
REMOTE_USER="${3:-ubuntu}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

echo "=========================================="
echo "远程服务器环境测试"
echo "=========================================="
echo "服务器: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
echo ""

# SSH 命令封装
ssh_exec() {
  ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "$@" 2>&1
}

# 测试 SSH 连接
log_info "测试 SSH 连接..."
if ssh_exec "echo 'SSH 连接成功'" >/dev/null 2>&1; then
  log_success "SSH 连接正常"
else
  log_error "SSH 连接失败"
  echo ""
  echo "请检查："
  echo "  1. 服务器地址和端口是否正确"
  echo "  2. SSH 密钥是否已配置"
  echo "  3. 防火墙是否允许连接"
  exit 1
fi

# 检测操作系统
log_info "检测操作系统..."
OS_INFO=$(ssh_exec "cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null || uname -a")
echo "$OS_INFO" | head -5

if echo "$OS_INFO" | grep -qi "ubuntu"; then
  log_success "检测到 Ubuntu"
  OS_TYPE="ubuntu"
elif echo "$OS_INFO" | grep -qi "debian"; then
  log_success "检测到 Debian"
  OS_TYPE="debian"
elif echo "$OS_INFO" | grep -qi "centos\|rhel"; then
  log_success "检测到 CentOS/RHEL"
  OS_TYPE="centos"
else
  log_warn "无法识别操作系统"
  OS_TYPE="unknown"
fi

# 检查 sudo 权限
log_info "检查 sudo 权限..."
if ssh_exec "sudo -n true 2>/dev/null"; then
  log_success "有 sudo 无密码权限"
elif ssh_exec "sudo -v 2>/dev/null"; then
  log_warn "有 sudo 权限但需要密码"
else
  log_error "没有 sudo 权限"
fi

# 检查 Git
log_info "检查 Git..."
if ssh_exec "command -v git >/dev/null 2>&1"; then
  GIT_VERSION=$(ssh_exec "git --version")
  log_success "$GIT_VERSION"
else
  log_warn "Git 未安装"
fi

# 检查 Docker
log_info "检查 Docker..."
if ssh_exec "command -v docker >/dev/null 2>&1"; then
  DOCKER_VERSION=$(ssh_exec "docker --version")
  log_success "$DOCKER_VERSION"
  
  # 检查 Docker Compose
  if ssh_exec "docker compose version >/dev/null 2>&1"; then
    COMPOSE_VERSION=$(ssh_exec "docker compose version")
    log_success "$COMPOSE_VERSION"
  else
    log_warn "Docker Compose 插件未安装"
  fi
  
  # 检查 Docker 权限
  if ssh_exec "docker ps >/dev/null 2>&1"; then
    log_success "可以运行 docker 命令（无需 sudo）"
  else
    log_warn "需要 sudo 才能运行 docker 命令"
  fi
else
  log_warn "Docker 未安装"
fi

# 检查 Python
log_info "检查 Python..."
if ssh_exec "command -v python3 >/dev/null 2>&1"; then
  PYTHON_VERSION=$(ssh_exec "python3 --version")
  log_success "$PYTHON_VERSION"
else
  log_warn "Python3 未安装"
fi

# 检查 GPU
log_info "检查 GPU..."
if ssh_exec "command -v nvidia-smi >/dev/null 2>&1"; then
  GPU_INFO=$(ssh_exec "nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo 'GPU 查询失败'")
  log_success "NVIDIA GPU 已检测到"
  echo "  $GPU_INFO"
  
  # 检查 Docker GPU 支持
  if ssh_exec "command -v docker >/dev/null 2>&1"; then
    if ssh_exec "docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi >/dev/null 2>&1"; then
      log_success "Docker GPU 支持正常"
    else
      log_warn "Docker GPU 支持未配置"
    fi
  fi
else
  log_warn "未检测到 NVIDIA GPU 或驱动"
fi

# 检查 espeak-ng
log_info "检查 espeak-ng..."
if ssh_exec "command -v espeak-ng >/dev/null 2>&1"; then
  log_success "espeak-ng 已安装"
else
  log_warn "espeak-ng 未安装"
fi

# 检查磁盘空间
log_info "检查磁盘空间..."
DISK_INFO=$(ssh_exec "df -h / | tail -1")
log_info "$DISK_INFO"

# 检查内存
log_info "检查内存..."
MEM_INFO=$(ssh_exec "free -h | grep Mem")
log_info "$MEM_INFO"

# 总结
echo ""
echo "=========================================="
echo "环境检测总结"
echo "=========================================="
echo "操作系统: $OS_TYPE"
echo ""
echo "缺失的依赖："
MISSING=()
ssh_exec "command -v git >/dev/null 2>&1" || MISSING+=("Git")
ssh_exec "command -v docker >/dev/null 2>&1" || MISSING+=("Docker")
ssh_exec "command -v python3 >/dev/null 2>&1" || MISSING+=("Python3")
ssh_exec "command -v espeak-ng >/dev/null 2>&1" || MISSING+=("espeak-ng")

if [ ${#MISSING[@]} -eq 0 ]; then
  log_success "所有必需依赖已安装"
else
  log_warn "缺失依赖: ${MISSING[*]}"
  echo ""
  echo "运行以下命令自动安装："
  echo "  ./scripts/remote-deploy-gpu.sh"
fi

echo ""
echo "=========================================="
