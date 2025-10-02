#!/usr/bin/env bash
# 远程 GPU 服务器部署脚本（增强版）
# 用于自动化部署到 Ubuntu + NVIDIA GPU 服务器
# 包含完整的依赖检测和自动安装功能

set -euo pipefail

# 配置变量
REMOTE_HOST="${REMOTE_HOST:-49.234.30.246}"
REMOTE_PORT="${REMOTE_PORT:-60022}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_PATH="${REMOTE_PATH:-~/english-listening-trainer}"
GIT_BRANCH="${GIT_BRANCH:-main}"
GIT_REPO="${GIT_REPO:-}"  # 如果项目不存在，需要提供仓库地址
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
RUN_TESTS="${RUN_TESTS:-false}"
AUTO_INSTALL_DEPS="${AUTO_INSTALL_DEPS:-true}"
SKIP_GPU_CHECK="${SKIP_GPU_CHECK:-false}"
ASSUME_YES="${ASSUME_YES:-false}"
SUDO_PASSWORD="${SUDO_PASSWORD:-Abcd.1234}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

usage() {
  cat <<EOF
用法: $0 [选项]

选项:
  --host HOST         远程服务器地址 (默认: ${REMOTE_HOST})
  --port PORT         SSH 端口 (默认: ${REMOTE_PORT})
  --user USER         SSH 用户 (默认: ${REMOTE_USER})
  --path PATH         远程项目路径 (默认: ${REMOTE_PATH})
  --branch BRANCH     Git 分支 (默认: ${GIT_BRANCH})
  --repo URL          Git 仓库地址（首次部署需要）
  --no-backup         跳过部署前备份
  --no-auto-install   不自动安装缺失的依赖
  --skip-gpu-check    跳过 GPU 检查
  --run-tests         部署前运行测试
  --yes, -y           自动确认所有提示（完全自动化）
  --password PASS     sudo 密码（默认: Abcd.1234）
  --debug             启用调试模式
  -h, --help          显示帮助信息

环境变量:
  REMOTE_HOST         远程服务器地址
  REMOTE_PORT         SSH 端口
  REMOTE_USER         SSH 用户
  REMOTE_PATH         远程项目路径
  GIT_BRANCH          Git 分支
  GIT_REPO            Git 仓库地址
  AUTO_INSTALL_DEPS   自动安装依赖（true/false）
  DEBUG               启用调试输出（true/false）

示例:
  $0                                    # 使用默认配置部署
  $0 --host 1.2.3.4 --port 22          # 指定服务器和端口
  $0 --branch develop --run-tests      # 部署 develop 分支并运行测试
  $0 --repo https://github.com/user/repo.git  # 首次部署指定仓库
  $0 --debug                            # 启用调试模式查看详细信息
EOF
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) REMOTE_HOST="$2"; shift 2 ;;
    --port) REMOTE_PORT="$2"; shift 2 ;;
    --user) REMOTE_USER="$2"; shift 2 ;;
    --path) REMOTE_PATH="$2"; shift 2 ;;
    --branch) GIT_BRANCH="$2"; shift 2 ;;
    --repo) GIT_REPO="$2"; shift 2 ;;
    --no-backup) BACKUP_BEFORE_DEPLOY=false; shift ;;
    --no-auto-install) AUTO_INSTALL_DEPS=false; shift ;;
    --skip-gpu-check) SKIP_GPU_CHECK=true; shift ;;
    --run-tests) RUN_TESTS=true; shift ;;
    --yes|-y) ASSUME_YES=true; shift ;;
    --password) SUDO_PASSWORD="$2"; shift 2 ;;
    --debug) DEBUG=true; set -x; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "未知选项: $1"; usage; exit 1 ;;
  esac
done

# SSH 命令封装
ssh_exec() {
  ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

# SSH 命令封装（带 sudo 密码）
ssh_exec_sudo() {
  ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "echo '${SUDO_PASSWORD}' | sudo -S bash -c \"$*\""
}

# 检查本地环境
check_local_env() {
  log_info "检查本地环境..."
  
  if ! command -v git >/dev/null 2>&1; then
    log_error "Git 未安装"
    exit 1
  fi
  
  if ! command -v ssh >/dev/null 2>&1; then
    log_error "SSH 未安装"
    exit 1
  fi
  
  # 检查是否在 Git 仓库中
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    log_error "当前目录不是 Git 仓库"
    exit 1
  fi
  
  # 检查是否有未提交的更改
  if ! git diff --quiet; then
    log_warn "工作目录有未提交的更改"
    if [ "$ASSUME_YES" = false ]; then
      echo -n "是否继续？[y/N]: "
      read -r response
      if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "部署已取消"
        exit 0
      fi
    else
      log_info "自动模式：继续部署"
    fi
  fi
  
  log_success "本地环境检查通过"
}

# 测试 SSH 连接
test_ssh_connection() {
  log_info "测试 SSH 连接..."
  
  if ! ssh_exec "echo 'SSH 连接成功'" >/dev/null 2>&1; then
    log_error "无法连接到远程服务器"
    log_info "请检查:"
    log_info "  - 服务器地址: ${REMOTE_HOST}"
    log_info "  - SSH 端口: ${REMOTE_PORT}"
    log_info "  - 用户名: ${REMOTE_USER}"
    log_info "  - SSH 密钥或密码配置"
    exit 1
  fi
  
  log_success "SSH 连接测试通过"
}

# 检测操作系统
detect_remote_os() {
  # 尝试多种方法检测操作系统（不输出日志到 stdout）
  local os_info=$(ssh_exec "cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null || uname -a")
  
  # 调试输出到 stderr
  if [ -n "${DEBUG:-}" ]; then
    echo "[DEBUG] OS 检测信息: $os_info" >&2
  fi
  
  # 检测 Ubuntu
  if echo "$os_info" | grep -qi "ubuntu"; then
    echo "[INFO] 检测到 Ubuntu" >&2
    echo "ubuntu"
    return 0
  fi
  
  # 检测 Debian
  if echo "$os_info" | grep -qi "debian"; then
    echo "[INFO] 检测到 Debian" >&2
    echo "debian"
    return 0
  fi
  
  # 检测 CentOS/RHEL
  if echo "$os_info" | grep -qi "centos\|rhel\|red hat"; then
    echo "[INFO] 检测到 CentOS/RHEL" >&2
    echo "centos"
    return 0
  fi
  
  # 未知系统
  echo "[WARN] 无法识别操作系统" >&2
  echo "[INFO] 系统信息: $(echo "$os_info" | head -3)" >&2
  echo "unknown"
  return 1
}

# 安装系统依赖
install_system_dependencies() {
  local os_type="$1"
  
  log_step "安装系统依赖..."
  
  case "$os_type" in
    ubuntu|debian)
      # 清理可能损坏的 Docker 配置文件
      log_info "清理损坏的配置文件..."
      ssh_exec_sudo "rm -f /etc/apt/sources.list.d/docker.list"
      
      ssh_exec_sudo "apt-get update -qq"
      ssh_exec_sudo "apt-get install -y -qq curl wget git build-essential ca-certificates gnupg lsb-release"
      ;;
    centos)
      ssh_exec_sudo "yum install -y -q curl wget git gcc make ca-certificates"
      ;;
    *)
      log_warn "未知操作系统，跳过系统依赖安装"
      ;;
  esac
  
  log_success "系统依赖安装完成"
}

# 安装 Docker
install_docker() {
  local os_type="$1"
  
  log_step "安装 Docker..."
  
  case "$os_type" in
    ubuntu|debian)
      log_info "使用 Ubuntu/Debian 安装方法..."
      
      log_info "手动安装 Docker..."
      
      # 使用一个完整的脚本块，只需要一次密码输入
      ssh_exec "cat > /tmp/install-docker.sh << 'DOCKER_INSTALL_SCRIPT'
#!/bin/bash
set -e

# 清理可能损坏的配置
rm -f /etc/apt/sources.list.d/docker.list

# 卸载旧版本
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# 更新并安装依赖
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker GPG 密钥（尝试国内镜像）
mkdir -p /etc/apt/keyrings

# 尝试阿里云镜像
if curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null; then
  echo \"使用阿里云镜像\"
  echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu \$(lsb_release -cs) stable\" > /etc/apt/sources.list.d/docker.list
elif curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null; then
  echo \"使用清华镜像\"
  echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu \$(lsb_release -cs) stable\" > /etc/apt/sources.list.d/docker.list
else
  echo \"使用官方源\"
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" > /etc/apt/sources.list.d/docker.list
fi

# 安装 Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动服务
systemctl start docker
systemctl enable docker

# 添加用户到 docker 组
usermod -aG docker ${REMOTE_USER}

echo \"Docker 安装完成\"
DOCKER_INSTALL_SCRIPT
chmod +x /tmp/install-docker.sh
echo '${SUDO_PASSWORD}' | sudo -S bash /tmp/install-docker.sh
rm /tmp/install-docker.sh
"
      ;;
      
    centos)
      log_info "使用 CentOS/RHEL 安装方法..."
      
      ssh_exec_sudo "yum install -y yum-utils"
      ssh_exec_sudo "yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
      ssh_exec_sudo "yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
      ssh_exec_sudo "systemctl start docker"
      ssh_exec_sudo "systemctl enable docker"
      ssh_exec_sudo "usermod -aG docker ${REMOTE_USER}"
      ;;
      
    unknown|*)
      log_error "无法识别操作系统类型: $os_type"
      log_error "请手动安装 Docker："
      log_error "  curl -fsSL https://get.docker.com | sudo sh"
      log_error "或访问: https://docs.docker.com/engine/install/"
      return 1
      ;;
  esac
  
  # 验证安装
  if ssh_exec "docker --version >/dev/null 2>&1"; then
    local docker_version=$(ssh_exec "docker --version 2>&1")
    log_success "Docker 安装成功: $docker_version"
    log_warn "注意：需要重新登录 SSH 才能使用 docker 命令（已添加到 docker 组）"
    return 0
  else
    log_error "Docker 安装失败"
    return 1
  fi
}

# 检查并安装 NVIDIA 驱动
check_and_install_nvidia_driver() {
  log_step "检查 NVIDIA 驱动..."
  
  if ssh_exec "command -v nvidia-smi >/dev/null 2>&1"; then
    local driver_version=$(ssh_exec "nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null || echo 'unknown'")
    log_success "检测到 NVIDIA 驱动版本: $driver_version"
    
    # 检查驱动版本是否足够
    local driver_major=$(echo "$driver_version" | cut -d. -f1)
    if [ "$driver_major" -ge 530 ]; then
      log_success "驱动版本支持 CUDA 12.1"
    elif [ "$driver_major" -ge 450 ]; then
      log_warn "驱动版本较旧，建议升级到 530+ 以支持 CUDA 12.1"
    else
      log_warn "驱动版本过旧，可能需要升级"
    fi
    
    return 0
  fi
  
  if [ "$SKIP_GPU_CHECK" = true ]; then
    log_warn "跳过 GPU 检查"
    return 0
  fi
  
  log_warn "未检测到 NVIDIA 驱动"
  
  if [ "$AUTO_INSTALL_DEPS" = false ]; then
    log_error "需要手动安装 NVIDIA 驱动"
    log_error "运行: sudo ubuntu-drivers autoinstall"
    return 1
  fi
  
  log_info "自动安装模式已启用，开始安装 NVIDIA 驱动..."
  log_warn "注意：安装驱动后需要重启服务器"
  
  log_step "安装 NVIDIA 驱动..."
  
  # 添加 NVIDIA 驱动 PPA
  ssh_exec_sudo "add-apt-repository -y ppa:graphics-drivers/ppa"
  ssh_exec_sudo "apt-get update -qq"
  
  # 安装推荐的驱动
  ssh_exec_sudo "ubuntu-drivers autoinstall"
  
  log_success "NVIDIA 驱动安装完成"
  log_warn "需要重启服务器才能使用 GPU"
}

# 安装 NVIDIA Container Toolkit
install_nvidia_container_toolkit() {
  log_step "检查 NVIDIA Container Toolkit..."
  
  if ssh_exec "docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi >/dev/null 2>&1"; then
    log_success "NVIDIA Container Toolkit 已安装"
    return 0
  fi
  
  log_step "安装 NVIDIA Container Toolkit..."
  
  # 添加 NVIDIA Container Toolkit 仓库
  ssh_exec "distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID) && echo \$distribution"
  
  ssh_exec "curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo -S gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg" <<< "${SUDO_PASSWORD}"
  
  ssh_exec "distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID) && curl -s -L https://nvidia.github.io/libnvidia-container/\$distribution/libnvidia-container.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo -S tee /etc/apt/sources.list.d/nvidia-container-toolkit.list" <<< "${SUDO_PASSWORD}"
  
  # 安装
  ssh_exec_sudo "apt-get update -qq"
  ssh_exec_sudo "apt-get install -y -qq nvidia-container-toolkit"
  
  # 配置 Docker
  ssh_exec_sudo "nvidia-ctk runtime configure --runtime=docker"
  ssh_exec_sudo "systemctl restart docker"
  
  log_success "NVIDIA Container Toolkit 安装完成"
}

# 安装 Python 和相关依赖
install_python_dependencies() {
  log_step "检查 Python 环境..."
  
  if ! ssh_exec "command -v python3 >/dev/null 2>&1"; then
    log_step "安装 Python..."
    ssh_exec_sudo "apt-get install -y -qq python3 python3-pip python3-venv python3-dev"
  fi
  
  local python_version=$(ssh_exec "python3 --version 2>&1 | grep -oP '\\d+\\.\\d+' | head -1")
  log_success "Python 版本: $python_version"
  
  # 检查 Python 版本是否在 3.8-3.12 范围内
  local py_major=$(echo "$python_version" | cut -d. -f1)
  local py_minor=$(echo "$python_version" | cut -d. -f2)
  
  if [ "$py_major" -eq 3 ] && [ "$py_minor" -ge 8 ] && [ "$py_minor" -le 12 ]; then
    log_success "Python 版本符合要求（3.8-3.12）"
  else
    log_warn "Python 版本不在推荐范围（3.8-3.12），当前: $python_version"
  fi
  
  # 安装 espeak-ng（TTS 依赖）
  if ! ssh_exec "command -v espeak-ng >/dev/null 2>&1"; then
    log_step "安装 espeak-ng..."
    ssh_exec_sudo "apt-get install -y -qq espeak-ng"
  fi
  
  log_success "Python 依赖安装完成"
}

# 检查远程环境（增强版）
check_remote_env() {
  log_step "检查远程服务器环境..."
  
  # 检测操作系统
  local os_type=$(detect_remote_os)
  log_info "操作系统: $os_type"
  
  local missing_deps=()
  local need_install=false
  
  # 检查 Git
  if ! ssh_exec "command -v git >/dev/null 2>&1"; then
    log_warn "Git 未安装"
    missing_deps+=("git")
    need_install=true
  else
    log_success "Git 已安装"
  fi
  
  # 检查 Docker
  if ! ssh_exec "command -v docker >/dev/null 2>&1"; then
    log_warn "Docker 未安装"
    missing_deps+=("docker")
    need_install=true
  else
    local docker_version=$(ssh_exec "docker --version 2>&1 | grep -oP '\\d+\\.\\d+\\.\\d+' | head -1")
    log_success "Docker 已安装: $docker_version"
    
    # 检查 Docker Compose
    if ! ssh_exec "docker compose version >/dev/null 2>&1"; then
      log_warn "Docker Compose 插件未安装"
      missing_deps+=("docker-compose")
      need_install=true
    else
      local compose_version=$(ssh_exec "docker compose version 2>&1 | grep -oP '\\d+\\.\\d+\\.\\d+' | head -1")
      log_success "Docker Compose 已安装: $compose_version"
    fi
  fi
  
  # 检查 Python
  if ! ssh_exec "command -v python3 >/dev/null 2>&1"; then
    log_warn "Python3 未安装"
    missing_deps+=("python3")
    need_install=true
  else
    local python_version=$(ssh_exec "python3 --version 2>&1 | grep -oP '\\d+\\.\\d+' | head -1")
    log_success "Python3 已安装: $python_version"
  fi
  
  # 如果有缺失的依赖
  if [ "$need_install" = true ]; then
    if [ "$AUTO_INSTALL_DEPS" = false ]; then
      log_error "缺少必需依赖: ${missing_deps[*]}"
      log_error "请手动安装或使用 --auto-install 选项"
      exit 1
    fi
    
    log_warn "检测到缺失的依赖: ${missing_deps[*]}"
    log_info "自动安装模式已启用，开始安装..."
    
    # 安装系统依赖
    install_system_dependencies "$os_type"
    
    # 安装 Docker（如果需要）
    if [[ " ${missing_deps[*]} " =~ " docker " ]]; then
      install_docker "$os_type"
    fi
    
    # 安装 Python 依赖
    if [[ " ${missing_deps[*]} " =~ " python3 " ]]; then
      install_python_dependencies
    fi
  fi
  
  # 检查 GPU 和驱动
  if [ "$SKIP_GPU_CHECK" = false ]; then
    check_and_install_nvidia_driver
    
    # 如果有 Docker 和 GPU，安装 NVIDIA Container Toolkit
    if ssh_exec "command -v docker >/dev/null 2>&1" && ssh_exec "command -v nvidia-smi >/dev/null 2>&1"; then
      install_nvidia_container_toolkit
    fi
  fi
  
  # 安装其他 Python 依赖
  install_python_dependencies
  
  # 检查项目目录
  if ! ssh_exec "[ -d ${REMOTE_PATH} ]"; then
    log_warn "远程项目目录不存在: ${REMOTE_PATH}"
    
    if [ -z "$GIT_REPO" ]; then
      # 尝试从本地 Git 获取仓库地址
      if git remote get-url origin >/dev/null 2>&1; then
        GIT_REPO=$(git remote get-url origin)
        log_info "从本地 Git 获取仓库地址: $GIT_REPO"
      else
        log_error "项目目录不存在且未提供 Git 仓库地址"
        log_error "请使用 --repo 选项指定仓库地址"
        exit 1
      fi
    fi
    
    log_step "克隆项目到 ${REMOTE_PATH}..."
    ssh_exec "git clone ${GIT_REPO} ${REMOTE_PATH}"
    ssh_exec "cd ${REMOTE_PATH} && git checkout ${GIT_BRANCH}"
    log_success "项目克隆完成"
  else
    log_success "项目目录已存在"
    
    # 检查是否是 Git 仓库
    if ssh_exec "[ -d ${REMOTE_PATH}/.git ]"; then
      local current_branch=$(ssh_exec "cd ${REMOTE_PATH} && git branch --show-current 2>/dev/null || echo 'unknown'")
      local current_commit=$(ssh_exec "cd ${REMOTE_PATH} && git rev-parse --short HEAD 2>/dev/null || echo 'unknown'")
      log_info "当前分支: $current_branch"
      log_info "当前提交: $current_commit"
    else
      log_warn "项目目录不是 Git 仓库"
    fi
  fi
  
  log_success "远程环境检查完成"
}

# 推送代码到远程仓库
push_code() {
  log_info "推送代码到远程仓库..."
  
  local current_branch=$(git branch --show-current)
  log_info "当前分支: ${current_branch}"
  
  if [[ "${current_branch}" != "${GIT_BRANCH}" ]]; then
    log_warn "当前分支 (${current_branch}) 与目标分支 (${GIT_BRANCH}) 不同"
    log_info "自动切换到 ${GIT_BRANCH} 分支"
    git checkout "${GIT_BRANCH}"
  fi
  
  # 提交更改（如果有）
  if ! git diff --quiet; then
    log_info "提交本地更改..."
    git add .
    git commit -m "部署到生产环境 $(date '+%Y-%m-%d %H:%M:%S')" || true
  fi
  
  # 推送到远程
  git push origin "${GIT_BRANCH}"
  
  local commit_hash=$(git rev-parse --short HEAD)
  log_success "代码已推送 (${commit_hash})"
}

# 在远程服务器上部署
deploy_on_remote() {
  log_info "开始远程部署..."
  
  # 创建部署脚本
  local deploy_script=$(cat <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

cd "${REMOTE_PATH}"

echo "[INFO] 当前目录: $(pwd)"

# 备份
if [ "${BACKUP_BEFORE_DEPLOY}" = "true" ]; then
  echo "[INFO] 创建备份..."
  if [ -f "scripts/backup.sh" ]; then
    ./scripts/backup.sh --compress || echo "[WARN] 备份失败，继续部署"
  else
    echo "[WARN] 备份脚本不存在，跳过备份"
  fi
fi

# 停止服务
echo "[INFO] 停止当前服务..."
if [ -f "docker-compose.gpu.yml" ]; then
  docker compose -f docker-compose.gpu.yml down || true
fi

# 拉取代码
echo "[INFO] 拉取最新代码..."
git fetch origin
git checkout "${GIT_BRANCH}"
git pull origin "${GIT_BRANCH}"

# 显示更新信息
echo "[INFO] 最近的提交:"
git log -3 --oneline

# 检查环境变量
if [ ! -f ".env.production" ]; then
  echo "[ERROR] .env.production 文件不存在"
  echo "[INFO] 请从 .env.production.example 创建并配置"
  exit 1
fi

# 检查 GPU 环境
echo "[INFO] 检查 GPU 环境..."
if [ -f "scripts/gpu-environment-check.sh" ]; then
  PYTHON_BIN=python3 ./scripts/gpu-environment-check.sh || echo "[WARN] GPU 检查失败"
fi

# 设置 Kokoro TTS
echo "[INFO] 设置 Kokoro TTS 环境..."
if [ -f "scripts/setup-kokoro-complete.sh" ]; then
  ./scripts/setup-kokoro-complete.sh || echo "[WARN] TTS 设置失败，应用仍可运行"
fi

# 使用 GPU 部署脚本
echo "[INFO] 执行 GPU 部署..."
if [ -f "scripts/deploy-gpu.sh" ]; then
  ./scripts/deploy-gpu.sh --skip-smoke
else
  echo "[INFO] 使用手动部署流程..."
  
  # 构建镜像
  docker compose -f docker-compose.gpu.yml build app
  
  # 运行迁移
  docker compose -f docker-compose.gpu.yml run --rm migrate
  
  # 启动应用
  docker compose -f docker-compose.gpu.yml up -d app
fi

# 等待服务启动
echo "[INFO] 等待服务启动..."
sleep 10

# 健康检查
echo "[INFO] 执行健康检查..."
if [ -f "scripts/health-check.sh" ]; then
  ./scripts/health-check.sh || echo "[WARN] 健康检查失败"
else
  # 简单的 HTTP 检查
  if command -v curl >/dev/null 2>&1; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health || echo "000")
    if [ "$response" = "200" ]; then
      echo "[SUCCESS] 应用健康检查通过"
    else
      echo "[ERROR] 应用健康检查失败: HTTP $response"
      exit 1
    fi
  fi
fi

# 显示服务状态
echo "[INFO] 服务状态:"
docker compose -f docker-compose.gpu.yml ps

echo "[SUCCESS] 部署完成!"
DEPLOY_SCRIPT
)

  # 执行远程部署
  ssh_exec "bash -s" <<EOF
export REMOTE_PATH="${REMOTE_PATH}"
export GIT_BRANCH="${GIT_BRANCH}"
export BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY}"

${deploy_script}
EOF

  log_success "远程部署完成"
}

# 显示部署信息
show_deployment_info() {
  log_info "=========================================="
  log_success "部署成功完成！"
  log_info "=========================================="
  log_info "服务器信息:"
  log_info "  地址: ${REMOTE_HOST}:${REMOTE_PORT}"
  log_info "  用户: ${REMOTE_USER}"
  log_info "  路径: ${REMOTE_PATH}"
  log_info "  分支: ${GIT_BRANCH}"
  log_info ""
  log_info "访问地址:"
  log_info "  应用: http://${REMOTE_HOST}:3000"
  log_info "  管理后台: http://${REMOTE_HOST}:3005"
  log_info ""
  log_info "常用命令:"
  log_info "  查看日志: ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && docker compose -f docker-compose.gpu.yml logs -f'"
  log_info "  重启服务: ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && docker compose -f docker-compose.gpu.yml restart'"
  log_info "  查看状态: ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} 'cd ${REMOTE_PATH} && docker compose -f docker-compose.gpu.yml ps'"
  log_info "=========================================="
}

# 主函数
main() {
  log_info "=========================================="
  log_info "远程 GPU 服务器部署脚本"
  log_info "=========================================="
  log_info "目标服务器: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
  log_info "项目路径: ${REMOTE_PATH}"
  log_info "Git 分支: ${GIT_BRANCH}"
  log_info "=========================================="
  
  # 确认部署（自动模式下跳过）
  if [ "$ASSUME_YES" = false ]; then
    echo -n "确认开始部署？[y/N]: "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      log_info "部署已取消"
      exit 0
    fi
  else
    log_info "自动部署模式已启用，开始部署..."
  fi
  
  # 执行部署流程
  check_local_env
  test_ssh_connection
  check_remote_env
  
  if [ "${RUN_TESTS}" = "true" ]; then
    log_info "运行本地测试..."
    npm run test:run || {
      log_error "测试失败"
      exit 1
    }
    log_success "测试通过"
  fi
  
  push_code
  deploy_on_remote
  show_deployment_info
}

# 错误处理
trap 'log_error "部署过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"
