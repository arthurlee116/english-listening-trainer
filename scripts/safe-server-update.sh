#!/bin/bash
# 安全更新服务器代码脚本
# 保留本地修改，合并远程更新

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

echo "=========================================="
echo "  安全更新服务器代码"
echo "=========================================="
echo ""

# 检查是否在 Git 仓库中
if [ ! -d ".git" ]; then
    log_error "当前目录不是 Git 仓库"
    exit 1
fi

# 显示当前状态
log_info "当前 Git 状态:"
git status --short

echo ""
log_warn "检测到本地修改"
echo ""
echo "选择操作:"
echo "1) 保存本地修改并拉取更新 (推荐)"
echo "2) 放弃本地修改并拉取更新"
echo "3) 取消操作"
echo ""
read -p "请选择 (1/2/3): " choice

case $choice in
    1)
        log_info "保存本地修改..."
        git stash push -m "Auto stash before update $(date +%Y%m%d_%H%M%S)"
        log_success "本地修改已保存"
        
        log_info "拉取远程更新..."
        git pull origin feature/exercise-template
        log_success "远程更新已拉取"
        
        log_info "恢复本地修改..."
        if git stash pop; then
            log_success "本地修改已恢复"
        else
            log_warn "恢复本地修改时发生冲突"
            echo ""
            echo "请手动解决冲突:"
            echo "1. 编辑冲突文件"
            echo "2. git add <文件>"
            echo "3. git stash drop"
            echo ""
            echo "或者放弃本地修改:"
            echo "git reset --hard"
            echo "git stash drop"
        fi
        ;;
    2)
        log_warn "将放弃所有本地修改"
        read -p "确定要继续吗? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "放弃本地修改..."
            git reset --hard HEAD
            git clean -fd
            log_success "本地修改已放弃"
            
            log_info "拉取远程更新..."
            git pull origin feature/exercise-template
            log_success "远程更新已拉取"
        else
            log_info "操作已取消"
            exit 0
        fi
        ;;
    3)
        log_info "操作已取消"
        exit 0
        ;;
    *)
        log_error "无效选择"
        exit 1
        ;;
esac

echo ""
log_success "代码更新完成"
echo ""
log_info "当前分支: $(git branch --show-current)"
log_info "最新提交: $(git log -1 --oneline)"
