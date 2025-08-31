#!/bin/bash
# PostgreSQL 本地安装备用方案
# 当Docker有问题时使用本地PostgreSQL

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

# PostgreSQL路径
POSTGRES_PREFIX="/opt/homebrew/opt/postgresql@15"
PSQL_CMD="$POSTGRES_PREFIX/bin/psql"
CREATEDB_CMD="$POSTGRES_PREFIX/bin/createdb"

# 检查是否有本地PostgreSQL安装
check_local_postgres() {
    if [ -x "$PSQL_CMD" ]; then
        echo_info "检测到本地PostgreSQL安装"
        return 0
    else
        echo_error "未检测到本地PostgreSQL安装"
        echo_info "请安装PostgreSQL: brew install postgresql@15"
        return 1
    fi
}

# 检查PostgreSQL服务状态
check_postgres_service() {
    if brew services list | grep postgresql@15 | grep -q started; then
        echo_success "PostgreSQL服务已运行"
        return 0
    else
        echo_warning "PostgreSQL服务未运行"
        return 1
    fi
}

# 启动PostgreSQL服务
start_postgres_service() {
    echo_info "启动PostgreSQL服务..."
    if brew services start postgresql@15; then
        echo_success "PostgreSQL服务启动成功"
        sleep 2
        return 0
    else
        echo_error "PostgreSQL服务启动失败"
        return 1
    fi
}

# 创建数据库和用户
setup_database() {
    local db_name="listening_app_dev"
    local db_user="postgres"
    
    echo_info "设置数据库..."
    
    # 检查数据库是否存在
    if $PSQL_CMD -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo_success "数据库 '$db_name' 已存在"
    else
        echo_info "创建数据库 '$db_name'..."
        if $CREATEDB_CMD "$db_name"; then
            echo_success "数据库创建成功"
        else
            echo_error "数据库创建失败"
            return 1
        fi
    fi
    
    show_connection_info
}

# 显示连接信息
show_connection_info() {
    echo ""
    echo_info "数据库连接信息："
    echo "----------------------------------------"
    echo "数据库名: listening_app_dev"
    echo "用户名:   $(whoami)"
    echo "端口:     5432"
    echo "连接URL:  postgresql://$(whoami)@localhost:5432/listening_app_dev"
    echo ""
    echo_info ".env.local 配置："
    echo "DATABASE_URL=postgresql://$(whoami)@localhost:5432/listening_app_dev"
    echo "----------------------------------------"
}

# 更新.env.local
update_env_config() {
    local new_url="postgresql://$(whoami)@localhost:5432/listening_app_dev"
    
    if [ -f ".env.local" ]; then
        echo_info "更新 .env.local 配置..."
        if grep -q "DATABASE_URL=" .env.local; then
            # 替换现有的DATABASE_URL
            sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$new_url|" .env.local
        else
            # 添加新的DATABASE_URL
            echo "DATABASE_URL=$new_url" >> .env.local
        fi
        echo_success "配置已更新"
    else
        echo_warning ".env.local 文件不存在"
    fi
}

# 主函数
main() {
    echo_info "PostgreSQL 本地安装备用方案"
    echo_info "============================"
    
    # 检查本地PostgreSQL
    if ! check_local_postgres; then
        exit 1
    fi
    
    # 检查服务状态
    if ! check_postgres_service; then
        # 尝试启动服务
        if ! start_postgres_service; then
            exit 1
        fi
    fi
    
    # 设置数据库
    if setup_database; then
        # 更新配置
        update_env_config
        
        echo ""
        echo_success "本地PostgreSQL设置完成！"
        echo_info "现在可以运行: npm run db:migrate"
    else
        exit 1
    fi
}

main "$@"