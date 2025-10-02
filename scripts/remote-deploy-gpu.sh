#!/usr/bin/env bash
# 远程 GPU 服务器部署脚本
# 用于自动化部署到 Ubuntu + NVIDIA GPU 服务器

set -euo pipefail

# 配置变量
REMOTE_HOST="${REMOTE_HOST:-49.234.30.246}"
REMOTE_PORT="${REMOTE_PORT:-60022}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
REMOTE_PATH="${REMOTE_PATH:-~/english-listening-trainer}"
GIT_BRANCH="${GIT_BRANCH:-main}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
RUN_TESTS="${RUN_TESTS:-false}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
  cat <<EOF
用法: $0 [选项]

选项:
  --host HOST         远程服务器地址 (默认: ${REMOTE_HOST})
  --port PORT         SSH 端口 (默认: ${REMOTE_PORT})
  --user USER         SSH 用户 (默认: ${REMOTE_USER})
  --path PATH         远程项目路径 (默认: ${REMOTE_PATH})
  --branch BRANCH     Git 分支 (默认: ${GIT_BRANCH})
  --no-backup         跳过部署前备份
  --run-tests         部署前运行测试
  -h, --help          显示帮助信息

环境变量:
  REMOTE_HOST         远程服务器地址
  REMOTE_PORT         SSH 端口
  REMOTE_USER         SSH 用户
  REMOTE_PATH         远程项目路径
  GIT_BRANCH          Git 分支

示例:
  $0                                    # 使用默认配置部署
  $0 --host 1.2.3.4 --port 22          # 指定服务器和端口
  $0 --branch develop --run-tests      # 部署 develop 分支并运行测试
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
    --no-backup) BACKUP_BEFORE_DEPLOY=false; shift ;;
    --run-tests) RUN_TESTS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) log_error "未知选项: $1"; usage; exit 1 ;;
  esac
done

# SSH 命令封装
ssh_exec() {
  ssh -p "${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
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
    echo -n "是否继续？[y/N]: "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      log_info "部署已取消"
      exit 0
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

# 检查远程环境
check_remote_env() {
  log_info "检查远程服务器环境..."
  
  # 检查必需命令
  local required_commands=("git" "docker" "python3")
  for cmd in "${required_commands[@]}"; do
    if ! ssh_exec "command -v $cmd >/dev/null 2>&1"; then
      log_error "远程服务器缺少必需命令: $cmd"
      exit 1
    fi
  done
  
  # 检查 Docker Compose
  if ! ssh_exec "docker compose version >/dev/null 2>&1"; then
    log_error "远程服务器未安装 Docker Compose"
    exit 1
  fi
  
  # 检查 GPU
  if ssh_exec "command -v nvidia-smi >/dev/null 2>&1"; then
    log_success "检测到 NVIDIA GPU"
    ssh_exec "nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader" || true
  else
    log_warn "未检测到 NVIDIA GPU 或驱动"
  fi
  
  # 检查项目目录
  if ! ssh_exec "[ -d ${REMOTE_PATH} ]"; then
    log_warn "远程项目目录不存在: ${REMOTE_PATH}"
    echo -n "是否创建并初始化项目？[y/N]: "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
      ssh_exec "mkdir -p ${REMOTE_PATH}"
      log_success "已创建项目目录"
    else
      log_error "项目目录不存在，部署已取消"
      exit 1
    fi
  fi
  
  log_success "远程环境检查通过"
}

# 推送代码到远程仓库
push_code() {
  log_info "推送代码到远程仓库..."
  
  local current_branch=$(git branch --show-current)
  log_info "当前分支: ${current_branch}"
  
  if [[ "${current_branch}" != "${GIT_BRANCH}" ]]; then
    log_warn "当前分支 (${current_branch}) 与目标分支 (${GIT_BRANCH}) 不同"
    echo -n "是否切换到 ${GIT_BRANCH} 分支？[y/N]: "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
      git checkout "${GIT_BRANCH}"
    else
      log_info "使用当前分支继续"
      GIT_BRANCH="${current_branch}"
    fi
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
  
  # 确认部署
  echo -n "确认开始部署？[y/N]: "
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    log_info "部署已取消"
    exit 0
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
