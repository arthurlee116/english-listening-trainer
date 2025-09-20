#!/bin/bash
# 数据库初始化脚本 - 生产环境部署使用
# 等待数据库启动，运行 Prisma 迁移和初始化

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

# 检查环境变量
check_env() {
    echo_info "检查环境变量配置..."
    
    # 检查数据库配置
    if [ -z "$DATABASE_URL" ]; then
        echo_warning "DATABASE_URL 未设置，使用默认 SQLite"
        export DATABASE_TYPE=sqlite
        export DATABASE_URL="file:./data/app.db"
    fi
    
    if [ -z "$DATABASE_TYPE" ]; then
        export DATABASE_TYPE=sqlite
    fi
    
    # 检查 JWT 密钥
    if [ -z "$JWT_SECRET" ]; then
        echo_warning "JWT_SECRET 未设置，生成临时密钥"
        export JWT_SECRET=$(openssl rand -hex 32)
        echo_warning "生产环境请设置固定的 JWT_SECRET: $JWT_SECRET"
    fi
    
    # 检查管理员账户配置
    if [ -z "$ADMIN_EMAIL" ]; then
        export ADMIN_EMAIL="admin@listeningtrain.com"
        echo_info "使用默认管理员邮箱: $ADMIN_EMAIL"
    fi
    
    if [ -z "$ADMIN_PASSWORD" ]; then
        export ADMIN_PASSWORD="Admin123456"
        echo_warning "使用默认管理员密码，生产环境请修改"
    fi
    
    if [ -z "$ADMIN_NAME" ]; then
        export ADMIN_NAME="System Administrator"
    fi
    
    # 检查 Cerebras API 密钥
    if [ -z "$CEREBRAS_API_KEY" ]; then
        echo_warning "CEREBRAS_API_KEY 未设置，AI 功能将不可用"
    fi
    
    echo_info "数据库类型: $DATABASE_TYPE"
    echo_info "数据库连接: $DATABASE_URL"
    echo_info "管理员邮箱: $ADMIN_EMAIL"
}

# 等待数据库服务启动
wait_for_db() {
    if [ "$DATABASE_TYPE" = "postgresql" ] || [ "$DATABASE_TYPE" = "postgres" ]; then
        echo_info "等待 PostgreSQL 数据库启动..."
        
        # 解析数据库连接信息
        DB_HOST=${DB_HOST:-localhost}
        DB_PORT=${DB_PORT:-5432}
        DB_USER=${DB_USER:-postgres}
        
        for i in {1..30}; do
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
                echo_success "PostgreSQL 数据库已就绪"
                break
            fi
            
            echo_info "等待数据库启动... ($i/30)"
            sleep 2
            
            if [ $i -eq 30 ]; then
                echo_error "PostgreSQL 数据库启动超时"
                exit 1
            fi
        done
        
    elif [ "$DATABASE_TYPE" = "mysql" ]; then
        echo_info "等待 MySQL 数据库启动..."
        
        DB_HOST=${DB_HOST:-localhost}
        DB_PORT=${DB_PORT:-3306}
        DB_USER=${DB_USER:-user}
        DB_PASSWORD=${DB_PASSWORD:-password}
        
        for i in {1..30}; do
            if mysqladmin ping -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --silent >/dev/null 2>&1; then
                echo_success "MySQL 数据库已就绪"
                break
            fi
            
            echo_info "等待数据库启动... ($i/30)"
            sleep 2
            
            if [ $i -eq 30 ]; then
                echo_error "MySQL 数据库启动超时"
                exit 1
            fi
        done
        
    else
        echo_info "使用 SQLite，无需等待数据库服务"
        
        # 确保 SQLite 数据目录存在
        mkdir -p /app/data
        chown -R nextjs:nodejs /app/data 2>/dev/null || true
    fi
}

# 运行 Prisma 迁移
run_migrations() {
    echo_info "运行数据库迁移..."
    
    # 生成 Prisma 客户端
    echo_info "生成 Prisma 客户端..."
    npx prisma generate
    
    if [ $? -eq 0 ]; then
        echo_success "Prisma 客户端生成完成"
    else
        echo_error "Prisma 客户端生成失败"
        exit 1
    fi
    
    # 运行数据库迁移
    echo_info "部署数据库迁移..."
    npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        echo_success "数据库迁移完成"
    else
        echo_warning "数据库迁移失败，尝试推送数据库架构..."
        npx prisma db push --force-reset
        
        if [ $? -eq 0 ]; then
            echo_success "数据库架构推送完成"
        else
            echo_error "数据库初始化失败"
            exit 1
        fi
    fi
}

# 初始化种子数据
seed_database() {
    echo_info "初始化种子数据..."
    
    # 检查并运行用户系统种子脚本
    if [ -f "./scripts/seed-user-db.ts" ]; then
        echo_info "运行用户系统种子脚本..."
        if command -v npm >/dev/null 2>&1; then
            npm exec tsx scripts/seed-user-db.ts
        else
            npx tsx scripts/seed-user-db.ts
        fi
        
        if [ $? -eq 0 ]; then
            echo_success "用户系统初始化完成"
        else
            echo_warning "用户系统初始化失败，将尝试手动创建管理员账户"
            create_admin_user
        fi
    else
        echo_info "未找到用户种子脚本，尝试手动创建管理员账户"
        create_admin_user
    fi
    
    # 检查是否存在其他种子脚本
    if [ -f "./scripts/seed-db.ts" ]; then
        echo_info "运行额外的数据库种子脚本..."
        if command -v npm >/dev/null 2>&1; then
            npm run db:seed 2>/dev/null || echo_warning "额外种子脚本执行失败，继续启动应用"
        fi
    fi
}

# 创建管理员账户
create_admin_user() {
    echo_info "创建管理员账户..."
    
    # 检查是否已存在管理员账户
    if command -v node >/dev/null 2>&1; then
        cat > temp_check_admin.js << 'EOF'
const { PrismaClient } = require('@prisma/client');

async function checkAdmin() {
    const prisma = new PrismaClient();
    try {
        const admin = await prisma.user.findFirst({
            where: { 
                OR: [
                    { role: 'admin' },
                    { email: process.env.ADMIN_EMAIL || 'admin@listeningtrain.com' }
                ]
            }
        });
        
        if (admin) {
            console.log('ADMIN_EXISTS');
            return;
        }
        
        // 创建管理员账户
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123456', 12);
        
        const newAdmin = await prisma.user.create({
            data: {
                email: process.env.ADMIN_EMAIL || 'admin@listeningtrain.com',
                name: process.env.ADMIN_NAME || 'System Administrator',
                password: hashedPassword,
                role: 'admin',
                emailVerified: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });
        
        console.log('ADMIN_CREATED');
    } catch (error) {
        console.error('ADMIN_ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdmin();
EOF
        
        # 运行检查脚本
        node temp_check_admin.js 2>/dev/null
        result=$?
        
        # 清理临时文件
        rm -f temp_check_admin.js
        
        if [ $result -eq 0 ]; then
            echo_success "管理员账户配置完成"
        else
            echo_warning "管理员账户创建可能有问题，请手动检查"
        fi
    else
        echo_warning "Node.js 不可用，跳过管理员账户创建"
    fi
}

# 数据库健康检查
health_check() {
    echo_info "执行数据库健康检查..."
    
    # 简单的数据库连接测试
    npx prisma db execute --command "SELECT 1" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo_success "数据库健康检查通过"
    else
        echo_error "数据库健康检查失败"
        exit 1
    fi
}

# 主函数
main() {
    echo_info "开始数据库初始化..."
    echo_info "========================================"
    
    # 检查环境变量
    check_env
    
    # 等待数据库服务启动
    wait_for_db
    
    # 运行迁移
    run_migrations
    
    # 初始化种子数据
    seed_database
    
    # 健康检查
    health_check
    
    echo_info "========================================"
    echo_success "数据库初始化完成！"
    echo_info "应用现在可以启动了"
}

# 错误处理
trap 'echo_error "数据库初始化过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"