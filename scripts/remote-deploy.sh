#!/bin/bash

# 远程服务器部署脚本
# 将英语听力训练应用部署到公网服务器

set -e

# 服务器配置
REMOTE_IP="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
REMOTE_PASSWORD="Abcd.1234"
APP_PORT="3000"
ADMIN_PORT="3005"

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

# 检查本地依赖
check_local_dependencies() {
    echo_info "检查本地依赖..."
    
    if ! command -v sshpass >/dev/null 2>&1; then
        echo_warning "sshpass 未安装，正在安装..."
        if command -v brew >/dev/null 2>&1; then
            brew install hudochenkov/sshpass/sshpass
        else
            echo_error "请先安装 sshpass: brew install hudochenkov/sshpass/sshpass"
            exit 1
        fi
    fi
    
    if ! command -v rsync >/dev/null 2>&1; then
        echo_error "rsync 未安装"
        exit 1
    fi
    
    echo_success "本地依赖检查完成"
}

# SSH连接函数
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_IP" "$1"
}

# SSH连接函数（支持sudo）
ssh_exec_sudo() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_IP" "echo '$REMOTE_PASSWORD' | sudo -S bash -c '$1'"
}

# SCP传输函数
scp_upload() {
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -P "$REMOTE_PORT" -r "$1" "$REMOTE_USER@$REMOTE_IP:$2"
}

# 测试SSH连接
test_ssh_connection() {
    echo_info "测试SSH连接..."
    
    if ssh_exec "echo 'SSH连接成功'"; then
        echo_success "SSH连接测试通过"
    else
        echo_error "SSH连接失败，请检查服务器信息"
        exit 1
    fi
}

# 修复dpkg状态
fix_dpkg_state() {
    echo_info "检查并修复dpkg状态..."
    
    # 配置未配置的包
    ssh_exec_sudo "dpkg --configure -a"
    
    # 修复中断的安装
    ssh_exec_sudo "apt --fix-broken install -y"
    
    # 清理损坏的包
    ssh_exec_sudo "apt autoremove -y && apt autoclean"
    
    # 杀死可能阻塞的进程
    ssh_exec_sudo "killall -9 apt apt-get dpkg 2>/dev/null || true"
    
    # 清理锁文件
    ssh_exec_sudo "rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock /var/lib/apt/lists/lock 2>/dev/null || true"
    
    # 重新配置dpkg
    ssh_exec_sudo "dpkg --configure -a"
    
    echo_success "dpkg状态修复完成"
}

# 安装服务器依赖
install_server_dependencies() {
    echo_info "安装服务器依赖..."
    
    # 先修复dpkg状态
    fix_dpkg_state
    
    # 更新系统
    ssh_exec_sudo "apt update"
    ssh_exec_sudo "DEBIAN_FRONTEND=noninteractive apt upgrade -y"
    
    # 安装基础工具
    ssh_exec_sudo "DEBIAN_FRONTEND=noninteractive apt install -y curl wget git build-essential python3 python3-pip python3-venv ufw"
    
    # 完全清理所有Node.js相关包以解决冲突
    echo_info "完全清理现有Node.js安装..."
    
    # 停止所有可能运行的Node.js进程
    ssh_exec_sudo "pkill -f node || true"
    
    # 完全卸载Ubuntu自带的Node.js和所有相关包
    ssh_exec_sudo "apt remove --purge -y nodejs npm libnode72 libnode-dev node-gyp 2>/dev/null || true"
    ssh_exec_sudo "apt remove --purge -y 'node*' 'libnode*' 'npm*' 2>/dev/null || true"
    
    # 清理自动安装的依赖
    ssh_exec_sudo "apt autoremove -y"
    ssh_exec_sudo "apt autoclean"
    
    # 手动删除可能的残留文件和目录
    ssh_exec_sudo "rm -rf /usr/local/bin/node /usr/local/bin/npm /usr/local/lib/node_modules 2>/dev/null || true"
    ssh_exec_sudo "rm -rf /usr/bin/node /usr/bin/npm 2>/dev/null || true"
    ssh_exec_sudo "rm -rf /opt/nodejs 2>/dev/null || true"
    ssh_exec_sudo "rm -rf /usr/share/systemtap/tapset/node.stp 2>/dev/null || true"
    
    # 清理包管理器缓存
    ssh_exec_sudo "apt update"
    
    echo_info "安装NodeSource Node.js 18+..."
    
    # 重新添加NodeSource仓库
    ssh_exec_sudo "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
    
    # 安装Node.js
    ssh_exec_sudo "DEBIAN_FRONTEND=noninteractive apt install -y nodejs"
    
    # 验证安装
    ssh_exec "node --version && npm --version"
    
    echo_success "Node.js安装完成"
    
    # 安装PM2
    if ! ssh_exec "command -v pm2 >/dev/null 2>&1"; then
        echo_info "安装PM2..."
        ssh_exec_sudo "npm install -g pm2"
    else
        echo_warning "PM2已安装，跳过安装步骤"
    fi
    
    # 安装SQLite3
    ssh_exec_sudo "DEBIAN_FRONTEND=noninteractive apt install -y sqlite3"
    
    echo_success "服务器依赖安装完成"
}

# 创建应用目录
setup_app_directory() {
    echo_info "设置应用目录..."
    
    ssh_exec "
        mkdir -p /home/ubuntu/listening-app
        mkdir -p /home/ubuntu/listening-app/data
        mkdir -p /home/ubuntu/listening-app/public/audio
        chmod -R 755 /home/ubuntu/listening-app
    "
    
    echo_success "应用目录创建完成"
}

# 上传代码
upload_code() {
    echo_info "上传代码到服务器..."
    
    # 排除不需要的文件和目录
    cat > .rsyncignore << EOF
node_modules/
.next/
.git/
*.log
.DS_Store
.env.local
data/app.db
public/audio/*.wav
kokoro-local/venv/
kokoro-local/__pycache__/
EOF
    
    # 同步代码
    sshpass -p "$REMOTE_PASSWORD" rsync -avz \
        --exclude-from=.rsyncignore \
        --delete \
        -e "ssh -o StrictHostKeyChecking=no -p $REMOTE_PORT" \
        ./ "$REMOTE_USER@$REMOTE_IP:/home/ubuntu/listening-app/"
    
    # 清理临时文件
    rm .rsyncignore
    
    echo_success "代码上传完成"
}

# 创建生产环境配置
create_production_config() {
    echo_info "创建生产环境配置..."
    
    # 创建生产环境变量文件
    ssh_exec "cat > /home/ubuntu/listening-app/.env.production << 'EOF'
# 生产环境配置
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Cerebras AI API
CEREBRAS_API_KEY=${CEREBRAS_API_KEY:-your_cerebras_api_key_here}

# Kokoro TTS 配置
PYTORCH_ENABLE_MPS_FALLBACK=0
KOKORO_VOICE=af_heart
KOKORO_SPEED=1.0
KOKORO_LANG_CODE=a
KOKORO_SAMPLE_RATE=24000
KOKORO_DEBUG=false

# 用户认证系统
JWT_SECRET=prod-jwt-secret-$(openssl rand -hex 32)

# 数据库配置 - SQLite
DATABASE_URL=file:/home/ubuntu/listening-app/data/app.db

# 管理员账号
ADMIN_EMAIL=admin@listeningtrain.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator

# 安全配置
SECURE_COOKIES=true
COOKIE_DOMAIN=49.234.30.246
ALLOWED_ORIGINS=http://49.234.30.246:3000,http://49.234.30.246:3005
EOF"
    
    echo_success "生产环境配置创建完成"
}

# 安装应用依赖
install_app_dependencies() {
    echo_info "安装应用依赖..."
    
    ssh_exec "
        cd /home/ubuntu/listening-app
        npm install --production
        npm run build
    "
    
    echo_success "应用依赖安装完成"
}

# 设置Kokoro TTS环境
setup_kokoro_tts() {
    echo_info "设置Kokoro TTS环境..."
    
    ssh_exec "
        cd /home/ubuntu/listening-app
        chmod +x scripts/setup-kokoro.sh
        ./scripts/setup-kokoro.sh
    "
    
    echo_success "Kokoro TTS环境设置完成"
}

# 初始化数据库
initialize_database() {
    echo_info "初始化数据库..."
    
    ssh_exec "
        cd /home/ubuntu/listening-app
        NODE_ENV=production npm run db:generate
        NODE_ENV=production npm run db:push
        NODE_ENV=production npm exec tsx scripts/seed-user-db.ts
        NODE_ENV=production npm exec tsx scripts/create-test-user.ts
    "
    
    echo_success "数据库初始化完成"
}

# 配置PM2
setup_pm2() {
    echo_info "配置PM2进程管理..."
    
    # 创建PM2配置文件
    ssh_exec "cat > /home/ubuntu/listening-app/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'listening-app',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/listening-app',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/home/ubuntu/listening-app/logs/app-error.log',
      out_file: '/home/ubuntu/listening-app/logs/app-out.log',
      log_file: '/home/ubuntu/listening-app/logs/app-combined.log'
    },
    {
      name: 'listening-admin',
      script: 'npm',
      args: 'run admin',
      cwd: '/home/ubuntu/listening-app',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        HOSTNAME: '0.0.0.0'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/ubuntu/listening-app/logs/admin-error.log',
      out_file: '/home/ubuntu/listening-app/logs/admin-out.log',
      log_file: '/home/ubuntu/listening-app/logs/admin-combined.log'
    }
  ]
};
EOF"
    
    # 创建日志目录
    ssh_exec "mkdir -p /home/ubuntu/listening-app/logs"
    
    echo_success "PM2配置完成"
}

# 配置防火墙
configure_firewall() {
    echo_info "配置防火墙..."
    
    ssh_exec_sudo "ufw --force enable"
    ssh_exec_sudo "ufw allow ssh"
    ssh_exec_sudo "ufw allow $REMOTE_PORT/tcp"
    ssh_exec_sudo "ufw allow $APP_PORT/tcp"
    ssh_exec_sudo "ufw allow $ADMIN_PORT/tcp"
    ssh_exec_sudo "ufw allow 80/tcp"
    ssh_exec_sudo "ufw allow 443/tcp"
    ssh_exec_sudo "ufw status"
    
    echo_success "防火墙配置完成"
}

# 启动应用
start_application() {
    echo_info "启动应用..."
    
    ssh_exec "
        cd /home/ubuntu/listening-app
        pm2 delete all || true
        pm2 start ecosystem.config.js
        pm2 save
        pm2 startup
    "
    
    echo_success "应用启动完成"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo_success "=========================================="
    echo_success "           部署完成！"
    echo_success "=========================================="
    echo ""
    echo_info "访问地址："
    echo "  主应用:     http://$REMOTE_IP:$APP_PORT"
    echo "  管理界面:   http://$REMOTE_IP:$ADMIN_PORT"
    echo ""
    echo_info "账号信息："
    echo "  管理员:     admin@listeningtrain.com / Admin123456"
    echo "  测试用户:   test@example.com / Test123456"
    echo ""
    echo_info "服务管理命令："
    echo "  查看状态:   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_IP 'pm2 status'"
    echo "  查看日志:   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_IP 'pm2 logs'"
    echo "  重启服务:   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_IP 'pm2 restart all'"
    echo "  停止服务:   ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_IP 'pm2 stop all'"
    echo ""
    echo_warning "注意: 如果无法访问，请检查服务器提供商的安全组/防火墙设置"
    echo_warning "需要开放端口: $APP_PORT, $ADMIN_PORT"
    echo ""
}

# 主函数
main() {
    local action="${1:-deploy}"
    
    case "$action" in
        "deploy")
            echo_info "开始远程部署..."
            echo_info "目标服务器: $REMOTE_IP:$REMOTE_PORT"
            echo ""
            
            check_local_dependencies
            test_ssh_connection
            install_server_dependencies
            setup_app_directory
            upload_code
            create_production_config
            install_app_dependencies
            setup_kokoro_tts
            initialize_database
            setup_pm2
            configure_firewall
            start_application
            show_deployment_info
            ;;
        "update")
            echo_info "更新应用代码..."
            upload_code
            ssh_exec "cd /home/ubuntu/listening-app && npm run build && pm2 restart all"
            echo_success "应用更新完成"
            ;;
        "status")
            echo_info "检查应用状态..."
            ssh_exec "pm2 status"
            ;;
        "logs")
            echo_info "查看应用日志..."
            ssh_exec "pm2 logs --lines 50"
            ;;
        "stop")
            echo_info "停止应用..."
            ssh_exec "pm2 stop all"
            ;;
        "start")
            echo_info "启动应用..."
            ssh_exec "pm2 start all"
            ;;
        "restart")
            echo_info "重启应用..."
            ssh_exec "pm2 restart all"
            ;;
        *)
            echo_info "用法: $0 [deploy|update|status|logs|stop|start|restart]"
            echo_info ""
            echo_info "命令说明:"
            echo_info "  deploy  - 完整部署应用到远程服务器"
            echo_info "  update  - 更新应用代码"
            echo_info "  status  - 查看应用状态"
            echo_info "  logs    - 查看应用日志"
            echo_info "  stop    - 停止应用"
            echo_info "  start   - 启动应用"  
            echo_info "  restart - 重启应用"
            ;;
    esac
}

# 错误处理
trap 'echo_error "部署过程中出现错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"