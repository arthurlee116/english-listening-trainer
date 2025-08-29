#!/bin/bash

# 数据库切换脚本
# 快速在 SQLite 和 PostgreSQL 之间切换

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

show_help() {
    cat << EOF
数据库切换脚本

用法: $0 [数据库类型]

支持的数据库类型:
  sqlite      切换到 SQLite 数据库
  postgres    切换到 PostgreSQL 数据库
  status      显示当前数据库配置

示例:
  $0 postgres     # 切换到 PostgreSQL
  $0 sqlite       # 切换到 SQLite  
  $0 status       # 查看当前配置

EOF
}

# 备份配置文件
backup_config() {
    if [ -f ".env.local" ]; then
        cp .env.local ".env.local.backup.$(date +%s)"
        echo_info "已备份当前配置"
    fi
}

# 切换到 SQLite
switch_to_sqlite() {
    echo_info "切换到 SQLite 数据库..."
    backup_config
    
    # 更新 .env.local
    sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=file:./data/app.db|' .env.local
    
    # 更新 Prisma Schema
    sed -i '' 's|provider = "postgresql"|provider = "sqlite"|' prisma/schema.prisma
    
    echo_success "已切换到 SQLite"
    echo_info "数据库文件: ./data/app.db"
    echo_warning "请运行: pnpm run db:generate"
}

# 切换到 PostgreSQL
switch_to_postgres() {
    echo_info "切换到 PostgreSQL 数据库..."
    backup_config
    
    # 更新 .env.local
    sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:dev_password@localhost:5433/listening_app|' .env.local
    
    # 更新 Prisma Schema
    sed -i '' 's|provider = "sqlite"|provider = "postgresql"|' prisma/schema.prisma
    
    echo_success "已切换到 PostgreSQL"
    echo_info "连接URL: postgresql://postgres:dev_password@localhost:5433/listening_app"
    echo_warning "请确保 PostgreSQL 服务已启动"
    echo_warning "请运行: pnpm run db:generate && pnpm run db:push"
}

# 显示当前配置
show_status() {
    echo_info "当前数据库配置:"
    echo "----------------------------------------"
    
    if [ -f ".env.local" ]; then
        local db_url=$(grep "^DATABASE_URL=" .env.local | cut -d'=' -f2-)
        echo "DATABASE_URL: $db_url"
    else
        echo_error ".env.local 文件不存在"
        return 1
    fi
    
    if [ -f "prisma/schema.prisma" ]; then
        local provider=$(grep 'provider = ' prisma/schema.prisma | grep -o '"[^"]*"' | tr -d '"')
        echo "Prisma Provider: $provider"
    else
        echo_error "prisma/schema.prisma 文件不存在"
        return 1
    fi
    
    echo "----------------------------------------"
    
    # 检查数据库连接
    if [[ "$db_url" == *"postgresql"* ]]; then
        echo_info "检查 PostgreSQL 连接..."
        if command -v docker >/dev/null 2>&1; then
            if docker ps --filter "name=postgres" --format "table {{.Names}}" | grep -q postgres; then
                echo_success "PostgreSQL 容器正在运行"
            else
                echo_warning "PostgreSQL 容器未运行"
                echo_info "运行命令启动: ./scripts/dev-db.sh start"
            fi
        fi
    elif [[ "$db_url" == *"file:"* ]]; then
        echo_info "检查 SQLite 文件..."
        local db_file=$(echo "$db_url" | sed 's|file:||')
        if [ -f "$db_file" ]; then
            local size=$(ls -lah "$db_file" | awk '{print $5}')
            echo_success "SQLite 文件存在: $db_file ($size)"
        else
            echo_warning "SQLite 文件不存在: $db_file"
        fi
    fi
}

# 主函数
main() {
    local command="${1:-status}"
    
    echo_info "数据库切换工具"
    echo_info "================"
    
    case "$command" in
        sqlite|sql)
            switch_to_sqlite
            ;;
        postgres|postgresql|pg)
            switch_to_postgres
            ;;
        status|info)
            show_status
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            echo_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"