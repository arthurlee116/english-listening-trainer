#!/bin/bash

# 修复Node.js包冲突的专用脚本
# 从根源彻底解决Ubuntu系统中libnode72与NodeSource nodejs的文件冲突

set -e

# 服务器配置
REMOTE_IP="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
REMOTE_PASSWORD="Abcd.1234"

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

# SSH连接函数（支持sudo）
ssh_exec_sudo() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_IP" "
        export SUDO_ASKPASS=/bin/false
        echo '$REMOTE_PASSWORD' | sudo -S sh -c '$1'
    "
}

# SSH连接函数
ssh_exec() {
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_IP" "$1"
}

# 彻底修复Node.js包冲突
fix_nodejs_conflict() {
    echo_info "开始彻底修复Node.js包冲突..."
    
    # 1. 停止所有Node.js相关进程
    echo_info "停止Node.js相关进程..."
    ssh_exec_sudo "pkill -f node || true"
    ssh_exec_sudo "pkill -f npm || true"
    
    # 2. 强制删除冲突的文件
    echo_info "手动删除冲突文件..."
    ssh_exec_sudo "rm -f /usr/share/systemtap/tapset/node.stp"
    ssh_exec_sudo "rm -f /usr/bin/node /usr/bin/npm"
    ssh_exec_sudo "rm -rf /usr/lib/node_modules"
    ssh_exec_sudo "rm -rf /usr/share/nodejs"
    
    # 3. 强制删除所有Node.js相关包的数据库记录
    echo_info "清理包数据库记录..."
    ssh_exec_sudo "dpkg --remove --force-remove-reinstreq nodejs 2>/dev/null || true"
    ssh_exec_sudo "dpkg --remove --force-remove-reinstreq libnode72 2>/dev/null || true"
    ssh_exec_sudo "dpkg --remove --force-remove-reinstreq npm 2>/dev/null || true"
    ssh_exec_sudo "dpkg --remove --force-remove-reinstreq libnode-dev 2>/dev/null || true"
    
    # 4. 清理dpkg状态
    echo_info "清理dpkg状态..."
    ssh_exec_sudo "dpkg --configure -a"
    ssh_exec_sudo "apt --fix-broken install -y"
    
    # 5. 强制清除包缓存中的问题文件
    echo_info "清理包缓存..."
    ssh_exec_sudo "rm -f /var/cache/apt/archives/nodejs_*.deb"
    ssh_exec_sudo "rm -f /var/cache/apt/archives/libnode*.deb"
    ssh_exec_sudo "apt clean"
    
    # 6. 更新包列表
    ssh_exec_sudo "apt update"
    
    # 7. 重新添加NodeSource仓库
    echo_info "重新配置NodeSource仓库..."
    ssh_exec_sudo "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
    
    # 8. 使用强制选项安装Node.js
    echo_info "强制安装NodeSource Node.js..."
    ssh_exec_sudo "DEBIAN_FRONTEND=noninteractive apt install -y --reinstall nodejs"
    
    # 如果仍然失败，使用dpkg强制安装
    if ! ssh_exec "command -v node >/dev/null 2>&1"; then
        echo_warning "正常安装失败，使用dpkg强制安装..."
        
        # 下载nodejs包
        ssh_exec_sudo "apt download nodejs"
        
        # 使用dpkg强制安装
        ssh_exec_sudo "dpkg --force-overwrite --force-confold -i nodejs_*.deb"
        
        # 修复依赖
        ssh_exec_sudo "apt --fix-broken install -y"
        
        # 清理下载的包
        ssh_exec "rm -f nodejs_*.deb"
    fi
    
    # 9. 验证安装
    echo_info "验证Node.js安装..."
    if ssh_exec "command -v node >/dev/null 2>&1"; then
        local node_version=$(ssh_exec "node --version")
        local npm_version=$(ssh_exec "npm --version")
        echo_success "Node.js安装成功！"
        echo_info "Node.js版本: $node_version"
        echo_info "npm版本: $npm_version"
    else
        echo_error "Node.js安装失败！"
        return 1
    fi
    
    # 10. 安装PM2
    echo_info "安装PM2..."
    if ! ssh_exec "command -v pm2 >/dev/null 2>&1"; then
        ssh_exec_sudo "npm install -g pm2"
        echo_success "PM2安装成功！"
    else
        echo_warning "PM2已安装"
    fi
    
    echo_success "Node.js包冲突修复完成！"
}

# 主函数
main() {
    echo_info "Node.js包冲突修复工具"
    echo_info "======================="
    
    fix_nodejs_conflict
}

# 错误处理
trap 'echo_error "修复过程中出现错误"; exit 1' ERR

# 执行主函数
main "$@"