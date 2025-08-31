#!/bin/bash

# 更可靠的Node.js冲突修复方案
# 直接在远程服务器上执行所有命令

set -e

REMOTE_IP="49.234.30.246"
REMOTE_PORT="60022"
REMOTE_USER="ubuntu"
REMOTE_PASSWORD="Abcd.1234"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 创建远程修复脚本
create_remote_fix_script() {
    echo_info "创建远程修复脚本..."
    
    # 创建修复脚本内容
    cat > /tmp/fix_nodejs.sh << 'EOF'
#!/bin/bash
set -e

echo "开始修复Node.js包冲突..."

# 停止Node.js进程
sudo pkill -f node || true
sudo pkill -f npm || true

echo "强制删除冲突文件..."
sudo rm -f /usr/share/systemtap/tapset/node.stp
sudo rm -f /usr/bin/node /usr/bin/npm
sudo rm -rf /usr/lib/node_modules
sudo rm -rf /usr/share/nodejs

echo "强制删除包记录..."
sudo dpkg --remove --force-remove-reinstreq nodejs 2>/dev/null || true
sudo dpkg --remove --force-remove-reinstreq libnode72 2>/dev/null || true
sudo dpkg --remove --force-remove-reinstreq npm 2>/dev/null || true
sudo dpkg --remove --force-remove-reinstreq libnode-dev 2>/dev/null || true

echo "清理包缓存..."
sudo rm -f /var/cache/apt/archives/nodejs_*.deb
sudo rm -f /var/cache/apt/archives/libnode*.deb
sudo apt clean

echo "修复dpkg状态..."
sudo dpkg --configure -a
sudo apt --fix-broken install -y

echo "更新包列表..."
sudo apt update

echo "重新添加NodeSource仓库..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -

echo "强制安装Node.js..."
sudo apt download nodejs
sudo dpkg --force-overwrite --force-confold -i nodejs_*.deb || true
sudo apt --fix-broken install -y
sudo apt install -f -y

echo "验证安装..."
node --version
npm --version

echo "安装PM2..."
sudo npm install -g pm2

echo "Node.js修复完成！"
EOF

    # 上传脚本到远程服务器
    sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no -P "$REMOTE_PORT" /tmp/fix_nodejs.sh "$REMOTE_USER@$REMOTE_IP:/tmp/"
    
    # 删除本地临时文件
    rm /tmp/fix_nodejs.sh
    
    echo_success "远程修复脚本创建完成"
}

# 执行远程修复脚本
execute_remote_fix() {
    echo_info "在远程服务器上执行修复..."
    
    # 给脚本添加执行权限并执行
    sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_IP" "
        chmod +x /tmp/fix_nodejs.sh
        echo '$REMOTE_PASSWORD' | /tmp/fix_nodejs.sh
        rm /tmp/fix_nodejs.sh
    "
}

# 主函数
main() {
    echo_info "Node.js冲突修复工具 v2"
    echo_info "========================"
    
    create_remote_fix_script
    execute_remote_fix
    
    echo_success "修复完成！现在可以继续部署了。"
}

# 错误处理
trap 'echo_error "修复过程中出现错误"; exit 1' ERR

# 执行主函数
main "$@"