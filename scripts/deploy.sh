#!/bin/bash
# 自动化部署脚本 - 英语听力训练应用
# 支持初始部署、更新部署和回滚功能
# Usage: ./deploy.sh [--init|--update|--rollback] [--environment] [--backup]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$APP_DIR/data"
LOGS_DIR="$APP_DIR/logs"
BACKUP_DIR="$APP_DIR/backups"
DEPLOY_DIR="$APP_DIR/.deploy"
DATE=$(date +%Y%m%d_%H%M%S)
DEPLOY_ID="deploy_${DATE}"

# 部署参数
DEPLOY_TYPE=""
ENVIRONMENT="production"
CREATE_BACKUP=true
FORCE_DEPLOY=false
SKIP_TESTS=false
SKIP_BUILD=false
ROLLBACK_ID=""

# Git 信息
GIT_BRANCH=""
GIT_COMMIT=""
PREVIOUS_COMMIT=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --init)
            DEPLOY_TYPE="init"
            shift
            ;;
        --update)
            DEPLOY_TYPE="update"
            shift
            ;;
        --rollback)
            DEPLOY_TYPE="rollback"
            if [ -n "$2" ] && [[ "$2" != --* ]]; then
                ROLLBACK_ID="$2"
                shift
            fi
            shift
            ;;
        --environment|--env)
            if [ -n "$2" ] && [[ "$2" != --* ]]; then
                ENVIRONMENT="$2"
                shift
            fi
            shift
            ;;
        --no-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [命令] [选项]"
            echo ""
            echo "命令:"
            echo "  --init              初始部署"
            echo "  --update            更新部署"
            echo "  --rollback [ID]     回滚到指定版本"
            echo ""
            echo "选项:"
            echo "  --environment ENV   部署环境 (production|staging) [默认: production]"
            echo "  --no-backup         不创建备份"
            echo "  --force             强制部署，跳过确认"
            echo "  --skip-tests        跳过测试"
            echo "  --skip-build        跳过构建"
            echo "  --help, -h          显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0 --init                      初始部署"
            echo "  $0 --update --environment production  生产环境更新"
            echo "  $0 --rollback deploy_20240829_120000   回滚到指定版本"
            exit 0
            ;;
        *)
            echo_error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 检查部署类型
if [ -z "$DEPLOY_TYPE" ]; then
    echo_error "请指定部署类型: --init, --update 或 --rollback"
    echo "使用 --help 查看帮助信息"
    exit 1
fi

# 检查环境
check_environment() {
    echo_info "检查部署环境..."
    
    # 检查操作系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo_info "检测到 macOS 环境"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo_info "检测到 Linux 环境"
    else
        echo_warning "未识别的操作系统: $OSTYPE"
    fi
    
    # 检查必需命令
    local required_commands=("git" "node" "npm")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo_error "缺少必需命令: $cmd"
            exit 1
        fi
    done
    
    # 检查可选命令
    local optional_commands=("pnpm" "pm2" "docker" "sqlite3")
    for cmd in "${optional_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo_info "发现可选命令: $cmd"
        fi
    done
    
    echo_success "环境检查通过"
}

# 检查 Git 状态
check_git_status() {
    echo_info "检查 Git 状态..."
    
    if [ ! -d "$APP_DIR/.git" ]; then
        echo_error "当前目录不是 Git 仓库"
        exit 1
    fi
    
    cd "$APP_DIR"
    
    # 获取当前分支和提交
    GIT_BRANCH=$(git branch --show-current)
    GIT_COMMIT=$(git rev-parse HEAD)
    PREVIOUS_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "")
    
    echo_info "当前分支: $GIT_BRANCH"
    echo_info "当前提交: ${GIT_COMMIT:0:8}"
    
    # 检查工作目录状态
    if [ "$DEPLOY_TYPE" != "rollback" ]; then
        if ! git diff --quiet; then
            echo_warning "工作目录有未提交的更改"
            if [ "$FORCE_DEPLOY" = false ]; then
                echo -n "是否继续部署？[y/N]: "
                read -r response
                if [[ ! "$response" =~ ^[Yy]$ ]]; then
                    echo_info "部署已取消"
                    exit 0
                fi
            fi
        fi
        
        # 检查是否有未推送的提交
        if git status --porcelain=v1 2>/dev/null | grep -q "^??"; then
            echo_warning "发现未跟踪的文件"
        fi
    fi
    
    echo_success "Git 状态检查完成"
}

# 创建部署目录
setup_deploy_dir() {
    echo_info "设置部署目录..."
    
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "$BACKUP_DIR"
    
    # 创建部署记录文件
    local deploy_record="$DEPLOY_DIR/deployments.log"
    if [ ! -f "$deploy_record" ]; then
        echo "# 部署记录日志" > "$deploy_record"
        echo "# 格式: [时间] 部署ID 类型 分支 提交 状态 备注" >> "$deploy_record"
    fi
    
    echo_success "部署目录设置完成"
}

# 记录部署信息
record_deployment() {
    local status="$1"
    local notes="$2"
    
    local deploy_record="$DEPLOY_DIR/deployments.log"
    echo "[$DATE] $DEPLOY_ID $DEPLOY_TYPE $GIT_BRANCH ${GIT_COMMIT:0:8} $status $notes" >> "$deploy_record"
}

# 停止应用
stop_application() {
    echo_info "停止应用服务..."
    
    local stopped=false
    
    # 停止 PM2 进程
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list 2>/dev/null | grep -q "online"; then
            pm2 stop all 2>/dev/null || true
            echo_info "PM2 应用已停止"
            stopped=true
        fi
    fi
    
    # 停止 Docker 服务
    if command -v docker-compose >/dev/null 2>&1; then
        if [ -f "$APP_DIR/docker-compose.production.yml" ]; then
            docker-compose -f docker-compose.production.yml down 2>/dev/null || true
            echo_info "Docker 服务已停止"
            stopped=true
        fi
    fi
    
    # 停止 Node.js 进程
    if pgrep -f "node.*next" >/dev/null 2>&1; then
        pkill -f "node.*next" 2>/dev/null || true
        sleep 3
        echo_info "Node.js 应用已停止"
        stopped=true
    fi
    
    if [ "$stopped" = false ]; then
        echo_info "未发现运行中的应用服务"
    fi
    
    echo_success "应用服务已停止"
}

# 启动应用
start_application() {
    echo_info "启动应用服务..."
    
    cd "$APP_DIR"
    
    # 优先使用 Docker
    if [ -f "docker-compose.production.yml" ] && command -v docker-compose >/dev/null 2>&1; then
        echo_info "使用 Docker Compose 启动应用..."
        docker-compose -f docker-compose.production.yml up -d
        echo_success "Docker 应用已启动"
        return
    fi
    
    # 使用 PM2
    if command -v pm2 >/dev/null 2>&1; then
        echo_info "使用 PM2 启动应用..."
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js
        else
            pm2 start npm --name "listening-training-app" -- start
        fi
        echo_success "PM2 应用已启动"
        return
    fi
    
    # 直接启动
    echo_info "直接启动应用..."
    nohup npm start > "$LOGS_DIR/app.log" 2>&1 &
    echo_success "应用已在后台启动"
}

# 创建备份
create_deployment_backup() {
    if [ "$CREATE_BACKUP" = true ] && [ "$DEPLOY_TYPE" != "rollback" ]; then
        echo_info "创建部署前备份..."
        
        local backup_script="$SCRIPT_DIR/backup.sh"
        if [ -f "$backup_script" ]; then
            chmod +x "$backup_script"
            "$backup_script" --compress || {
                echo_warning "备份创建失败，但部署将继续"
            }
        else
            echo_warning "备份脚本不存在，跳过备份"
        fi
    else
        echo_info "跳过备份创建"
    fi
}

# 拉取最新代码
pull_latest_code() {
    if [ "$DEPLOY_TYPE" = "rollback" ]; then
        echo_info "回滚到指定提交..."
        if [ -n "$ROLLBACK_ID" ]; then
            # 从部署记录中找到对应的提交
            local rollback_commit=$(grep "$ROLLBACK_ID" "$DEPLOY_DIR/deployments.log" | awk '{print $5}' | head -n 1)
            if [ -n "$rollback_commit" ]; then
                git checkout "$rollback_commit" || {
                    echo_error "回滚失败：无法切换到提交 $rollback_commit"
                    exit 1
                }
                echo_success "已回滚到提交: $rollback_commit"
            else
                echo_error "未找到部署记录: $ROLLBACK_ID"
                exit 1
            fi
        else
            echo_error "回滚操作需要指定部署ID"
            exit 1
        fi
    else
        echo_info "拉取最新代码..."
        git fetch origin || {
            echo_error "无法从远程仓库拉取代码"
            exit 1
        }
        
        git pull origin "$GIT_BRANCH" || {
            echo_error "无法拉取最新代码"
            exit 1
        }
        
        # 更新提交信息
        GIT_COMMIT=$(git rev-parse HEAD)
        echo_success "代码更新完成: ${GIT_COMMIT:0:8}"
    fi
}

# 安装依赖
install_dependencies() {
    echo_info "安装/更新依赖包..."
    
    cd "$APP_DIR"
    
    # 优先使用 pnpm
    if command -v pnpm >/dev/null 2>&1; then
        echo_info "使用 pnpm 安装依赖..."
        pnpm install --frozen-lockfile || pnpm install
    else
        echo_info "使用 npm 安装依赖..."
        npm ci || npm install
    fi
    
    echo_success "依赖安装完成"
}

# 运行测试
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        echo_info "跳过测试"
        return
    fi
    
    echo_info "运行测试..."
    
    cd "$APP_DIR"
    
    # 检查是否有测试脚本
    if npm run | grep -q "test"; then
        npm run test || {
            echo_error "测试失败"
            if [ "$FORCE_DEPLOY" = false ]; then
                exit 1
            else
                echo_warning "强制部署：忽略测试失败"
            fi
        }
        echo_success "测试通过"
    else
        echo_info "未找到测试脚本，跳过测试"
    fi
}

# 构建应用
build_application() {
    if [ "$SKIP_BUILD" = true ]; then
        echo_info "跳过构建"
        return
    fi
    
    echo_info "构建应用..."
    
    cd "$APP_DIR"
    
    # 设置生产环境
    export NODE_ENV=production
    
    # 构建应用
    npm run build || {
        echo_error "应用构建失败"
        exit 1
    }
    
    echo_success "应用构建完成"
}

# 数据库迁移
run_database_migration() {
    echo_info "运行数据库迁移..."
    
    cd "$APP_DIR"
    
    # 运行初始化脚本
    local init_script="$SCRIPT_DIR/init-db.sh"
    if [ -f "$init_script" ]; then
        chmod +x "$init_script"
        "$init_script" || {
            echo_error "数据库初始化失败"
            exit 1
        }
    else
        echo_warning "数据库初始化脚本不存在"
    fi
    
    echo_success "数据库迁移完成"
}

# 设置 TTS 环境
setup_tts_environment() {
    echo_info "设置 TTS 环境..."
    
    cd "$APP_DIR"
    
    # 检查并设置 Kokoro TTS
    if [ -f "scripts/setup-kokoro.sh" ]; then
        chmod +x scripts/setup-kokoro.sh
        ./scripts/setup-kokoro.sh || {
            echo_warning "TTS 环境设置失败，应用仍可运行但 TTS 功能不可用"
        }
    else
        echo_warning "TTS 设置脚本不存在"
    fi
    
    echo_success "TTS 环境设置完成"
}

# 验证部署
verify_deployment() {
    echo_info "验证部署结果..."
    
    # 等待应用启动
    echo_info "等待应用启动..."
    sleep 10
    
    # 检查健康状态
    local health_script="$SCRIPT_DIR/health-check.sh"
    if [ -f "$health_script" ]; then
        chmod +x "$health_script"
        if "$health_script" --json > /dev/null 2>&1; then
            echo_success "应用健康检查通过"
        else
            echo_error "应用健康检查失败"
            return 1
        fi
    else
        echo_warning "健康检查脚本不存在，进行基本验证"
        
        # 基本端口检查
        local app_port="${PORT:-3000}"
        if lsof -i :$app_port >/dev/null 2>&1; then
            echo_success "应用端口 $app_port 正在监听"
        else
            echo_error "应用端口 $app_port 未监听"
            return 1
        fi
        
        # HTTP 响应检查
        if command -v curl >/dev/null 2>&1; then
            local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 http://localhost:$app_port/api/health 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                echo_success "应用 HTTP 响应正常"
            else
                echo_error "应用 HTTP 响应异常: $response"
                return 1
            fi
        fi
    fi
    
    echo_success "部署验证通过"
}

# 清理部署
cleanup_deployment() {
    echo_info "清理部署文件..."
    
    # 清理旧的部署备份（保留最近5个）
    if [ -d "$DEPLOY_DIR" ]; then
        find "$DEPLOY_DIR" -name "deploy_*" -type d | sort -r | tail -n +6 | xargs rm -rf 2>/dev/null || true
    fi
    
    # 清理 npm 缓存
    npm cache clean --force 2>/dev/null || true
    
    # 清理临时文件
    find "$APP_DIR" -name "*.tmp" -type f -delete 2>/dev/null || true
    
    echo_success "清理完成"
}

# 发送部署通知
send_notification() {
    local status="$1"
    local message="$2"
    
    echo_info "发送部署通知..."
    
    # 记录到日志
    local notification_log="$LOGS_DIR/deployments.log"
    echo "[$DATE] $DEPLOY_TYPE $status: $message" >> "$notification_log"
    
    # 这里可以集成各种通知方式
    # 例如：Slack、钉钉、邮件、企业微信等
    
    # 示例：Slack 通知（需要配置 Webhook URL）
    # if [ -n "$SLACK_WEBHOOK_URL" ] && command -v curl >/dev/null 2>&1; then
    #     curl -X POST -H 'Content-type: application/json' \
    #         --data "{\"text\":\"部署通知: $message\"}" \
    #         "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    # fi
    
    echo_success "部署通知已发送"
}

# 初始部署
deploy_init() {
    echo_info "执行初始部署..."
    
    # 检查是否已经部署过
    if [ -f "$DEPLOY_DIR/deployments.log" ] && grep -q "SUCCESS" "$DEPLOY_DIR/deployments.log"; then
        echo_warning "检测到之前的部署记录"
        if [ "$FORCE_DEPLOY" = false ]; then
            echo -n "是否继续初始部署？[y/N]: "
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                echo_info "初始部署已取消"
                exit 0
            fi
        fi
    fi
    
    create_deployment_backup
    install_dependencies
    run_tests
    build_application
    run_database_migration
    setup_tts_environment
    start_application
    verify_deployment
    
    record_deployment "SUCCESS" "初始部署完成"
    send_notification "SUCCESS" "初始部署成功完成"
}

# 更新部署
deploy_update() {
    echo_info "执行更新部署..."
    
    create_deployment_backup
    stop_application
    pull_latest_code
    install_dependencies
    run_tests
    build_application
    run_database_migration
    setup_tts_environment
    start_application
    verify_deployment
    
    record_deployment "SUCCESS" "更新部署完成"
    send_notification "SUCCESS" "更新部署成功完成"
}

# 回滚部署
deploy_rollback() {
    echo_info "执行回滚部署..."
    
    stop_application
    pull_latest_code  # 这里会回滚到指定提交
    install_dependencies
    build_application
    start_application
    verify_deployment
    
    record_deployment "ROLLBACK" "回滚到 $ROLLBACK_ID"
    send_notification "SUCCESS" "回滚部署成功完成"
}

# 主函数
main() {
    echo_info "开始自动化部署..."
    echo_info "========================================"
    echo_info "部署时间: $DATE"
    echo_info "部署类型: $DEPLOY_TYPE"
    echo_info "部署环境: $ENVIRONMENT"
    echo_info "部署ID: $DEPLOY_ID"
    echo_info "========================================"
    
    # 检查环境
    check_environment
    check_git_status
    setup_deploy_dir
    
    # 加载环境变量
    if [ -f "$APP_DIR/.env.$ENVIRONMENT" ]; then
        source "$APP_DIR/.env.$ENVIRONMENT"
        echo_info "已加载环境配置: .env.$ENVIRONMENT"
    else
        echo_warning "未找到环境配置文件: .env.$ENVIRONMENT"
    fi
    
    # 最终确认
    if [ "$FORCE_DEPLOY" = false ]; then
        echo_warning "即将开始 $DEPLOY_TYPE 部署到 $ENVIRONMENT 环境"
        echo -n "确认继续？[y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo_info "部署已取消"
            exit 0
        fi
    fi
    
    # 执行部署
    case "$DEPLOY_TYPE" in
        "init")
            deploy_init
            ;;
        "update")
            deploy_update
            ;;
        "rollback")
            deploy_rollback
            ;;
    esac
    
    # 清理
    cleanup_deployment
    
    echo_info "========================================"
    echo_success "部署完成！"
    echo_info "部署ID: $DEPLOY_ID"
    echo_info "Git 提交: ${GIT_COMMIT:0:8}"
    echo_info "部署时间: $DATE"
    echo_info "========================================"
    echo_info "后续操作："
    echo_info "  查看应用状态: ./scripts/health-check.sh"
    echo_info "  查看应用日志: tail -f $LOGS_DIR/app.log"
    echo_info "  回滚此部署: ./scripts/deploy.sh --rollback $DEPLOY_ID"
    echo_info "========================================"
}

# 错误处理
handle_error() {
    echo_error "部署过程中发生错误，正在清理..."
    
    # 记录失败
    record_deployment "FAILED" "部署失败"
    send_notification "FAILED" "部署失败，请检查日志"
    
    # 尝试启动之前的服务
    start_application 2>/dev/null || true
    
    exit 1
}

trap handle_error ERR

# 执行主函数
main "$@"