#!/bin/bash
# 开发环境数据库启动脚本
# 快速启动本地 PostgreSQL Docker 容器，用于本地开发测试

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

# 默认配置
DB_NAME="listening_app_dev"
DB_USER="postgres"
DB_PASSWORD="dev_password"
DB_PORT="5433"
CONTAINER_NAME="listening-app-dev-db"

# 帮助信息
show_help() {
    cat << EOF
开发环境数据库管理脚本

用法: $0 [选项] [命令]

命令:
  start     启动开发数据库 (默认)
  stop      停止数据库容器
  restart   重启数据库容器
  reset     重置数据库（删除所有数据）
  logs      查看数据库日志
  connect   连接到数据库 shell
  status    查看数据库状态

选项:
  -h, --help     显示此帮助信息
  -n, --name     设置数据库名称 (默认: $DB_NAME)
  -u, --user     设置用户名 (默认: $DB_USER)
  -p, --port     设置端口 (默认: $DB_PORT)
  --password     设置密码 (默认: $DB_PASSWORD)

示例:
  $0 start                    # 启动开发数据库
  $0 -n mydb -p 5434 start    # 自定义数据库名和端口
  $0 reset                    # 重置数据库
  $0 connect                  # 连接数据库

EOF
}

# 检查 Docker 是否运行
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo_error "Docker 未运行或无法访问"
        echo_info "请先启动 Docker Desktop 或 Docker daemon"
        exit 1
    fi
}

# 检查容器是否存在
container_exists() {
    docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"
}

# 检查容器是否运行
container_running() {
    docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"
}

# 启动数据库
start_db() {
    echo_info "启动开发数据库..."
    
    if container_running; then
        echo_success "数据库容器已在运行"
        show_connection_info
        return
    fi
    
    if container_exists; then
        echo_info "启动现有容器..."
        docker start "$CONTAINER_NAME"
    else
        echo_info "创建新的数据库容器..."
        docker run -d \
            --name "$CONTAINER_NAME" \
            -p "$DB_PORT:5432" \
            -e POSTGRES_DB="$DB_NAME" \
            -e POSTGRES_USER="$DB_USER" \
            -e POSTGRES_PASSWORD="$DB_PASSWORD" \
            -e POSTGRES_INITDB_ARGS="--encoding=UTF-8" \
            -v "listening_app_dev_data:/var/lib/postgresql/data" \
            postgres:15-alpine
    fi
    
    # 等待数据库启动
    echo_info "等待数据库启动..."
    for i in {1..30}; do
        if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            echo_success "数据库启动成功！"
            break
        fi
        
        echo_info "等待中... ($i/30)"
        sleep 1
        
        if [ $i -eq 30 ]; then
            echo_error "数据库启动超时"
            exit 1
        fi
    done
    
    show_connection_info
    
    # 运行数据库初始化
    if [ -f ".env.local" ] && grep -q "DATABASE_URL.*postgresql" .env.local; then
        echo_info "检测到 PostgreSQL 配置，运行数据库迁移..."
        npm run db:migrate || echo_warning "数据库迁移失败，请手动运行 npm run db:migrate"
    else
        echo_warning "请更新 .env.local 中的 DATABASE_URL:"
        echo_info "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
    fi
}

# 停止数据库
stop_db() {
    echo_info "停止数据库容器..."
    
    if container_running; then
        docker stop "$CONTAINER_NAME"
        echo_success "数据库已停止"
    else
        echo_warning "数据库容器未运行"
    fi
}

# 重启数据库
restart_db() {
    echo_info "重启数据库容器..."
    
    if container_exists; then
        docker restart "$CONTAINER_NAME"
        echo_success "数据库已重启"
        show_connection_info
    else
        echo_warning "容器不存在，将创建新容器"
        start_db
    fi
}

# 重置数据库
reset_db() {
    echo_warning "这将删除所有数据库数据，确定继续吗？"
    read -p "输入 'yes' 确认: " confirm
    
    if [ "$confirm" = "yes" ]; then
        echo_info "重置数据库..."
        
        # 停止并删除容器
        if container_exists; then
            docker stop "$CONTAINER_NAME" 2>/dev/null || true
            docker rm "$CONTAINER_NAME" 2>/dev/null || true
        fi
        
        # 删除数据卷
        docker volume rm "listening_app_dev_data" 2>/dev/null || true
        
        # 重新启动
        start_db
        echo_success "数据库已重置"
    else
        echo_info "操作已取消"
    fi
}

# 查看日志
show_logs() {
    echo_info "显示数据库日志..."
    
    if container_exists; then
        docker logs -f "$CONTAINER_NAME"
    else
        echo_error "容器不存在"
        exit 1
    fi
}

# 连接数据库
connect_db() {
    echo_info "连接到数据库..."
    
    if container_running; then
        docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
    else
        echo_error "数据库容器未运行"
        echo_info "请先运行: $0 start"
        exit 1
    fi
}

# 查看状态
show_status() {
    echo_info "数据库状态:"
    echo "----------------------------------------"
    
    if container_exists; then
        if container_running; then
            echo_success "状态: 运行中"
            docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME"
            show_connection_info
        else
            echo_warning "状态: 已停止"
        fi
        
        echo ""
        echo_info "容器信息:"
        docker ps -a --filter "name=$CONTAINER_NAME" --format "table {{.Image}}\t{{.Status}}\t{{.Ports}}"
    else
        echo_warning "状态: 容器不存在"
        echo_info "运行 '$0 start' 创建并启动数据库"
    fi
}

# 显示连接信息
show_connection_info() {
    echo ""
    echo_info "数据库连接信息:"
    echo "----------------------------------------"
    echo "数据库名: $DB_NAME"
    echo "用户名:   $DB_USER"
    echo "端口:     $DB_PORT"
    echo "连接URL:  postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
    echo ""
    echo_info "连接命令:"
    echo "psql postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
    echo ""
    echo_info ".env.local 配置:"
    echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME"
    echo "----------------------------------------"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -n|--name)
                DB_NAME="$2"
                CONTAINER_NAME="listening-app-dev-db-${DB_NAME}"
                shift 2
                ;;
            -u|--user)
                DB_USER="$2"
                shift 2
                ;;
            -p|--port)
                DB_PORT="$2"
                shift 2
                ;;
            --password)
                DB_PASSWORD="$2"
                shift 2
                ;;
            start|stop|restart|reset|logs|connect|status)
                COMMAND="$1"
                shift
                ;;
            *)
                echo_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 主函数
main() {
    local COMMAND="${COMMAND:-start}"
    
    echo_info "英语听力训练应用 - 开发数据库管理"
    echo_info "========================================"
    
    # 检查 Docker
    check_docker
    
    case "$COMMAND" in
        start)
            start_db
            ;;
        stop)
            stop_db
            ;;
        restart)
            restart_db
            ;;
        reset)
            reset_db
            ;;
        logs)
            show_logs
            ;;
        connect)
            connect_db
            ;;
        status)
            show_status
            ;;
        *)
            echo_error "未知命令: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# 解析参数并运行
parse_args "$@"
main