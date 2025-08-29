#!/bin/bash
# 数据恢复脚本 - 英语听力训练应用
# 从备份文件恢复数据库、音频文件和配置
# Usage: ./restore.sh <backup_file> [--force] [--no-backup] [--verify]

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
AUDIO_DIR="$APP_DIR/public/audio"
LOGS_DIR="$APP_DIR/logs"
TEMP_DIR="/tmp/restore_$$"
DATE=$(date +%Y%m%d_%H%M%S)

# 命令行参数
BACKUP_FILE=""
FORCE_RESTORE=false
CREATE_BACKUP=true
VERIFY_RESTORE=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_RESTORE=true
            shift
            ;;
        --no-backup)
            CREATE_BACKUP=false
            shift
            ;;
        --verify)
            VERIFY_RESTORE=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 <backup_file> [选项]"
            echo ""
            echo "参数:"
            echo "  backup_file   要恢复的备份文件路径"
            echo ""
            echo "选项:"
            echo "  --force       强制恢复，不询问确认"
            echo "  --no-backup   恢复前不创建当前数据的备份"
            echo "  --verify      恢复后验证数据完整性"
            echo "  --help        显示此帮助信息"
            echo ""
            echo "示例:"
            echo "  $0 /path/to/backup_20240829_120000.tar.gz"
            echo "  $0 /path/to/backup_20240829_120000.tar.gz --force --verify"
            exit 0
            ;;
        -*)
            echo_error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                echo_error "只能指定一个备份文件"
                exit 1
            fi
            shift
            ;;
    esac
done

# 检查备份文件参数
if [ -z "$BACKUP_FILE" ]; then
    echo_error "请指定备份文件路径"
    echo "使用 --help 查看帮助信息"
    exit 1
fi

# 验证备份文件
validate_backup_file() {
    echo_info "验证备份文件..."
    
    if [ ! -f "$BACKUP_FILE" ] && [ ! -d "$BACKUP_FILE" ]; then
        echo_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    # 检查文件类型
    if [ -f "$BACKUP_FILE" ]; then
        if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
            echo_info "检测到压缩备份文件"
            BACKUP_TYPE="compressed"
            
            # 验证压缩文件完整性
            if ! tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
                echo_error "备份文件已损坏或不是有效的 tar.gz 文件"
                exit 1
            fi
        else
            echo_error "不支持的备份文件格式，请使用 .tar.gz 文件"
            exit 1
        fi
    elif [ -d "$BACKUP_FILE" ]; then
        echo_info "检测到目录格式备份"
        BACKUP_TYPE="directory"
        
        # 验证目录结构
        if [ ! -f "$BACKUP_FILE/metadata.json" ]; then
            echo_error "备份目录缺少 metadata.json 文件"
            exit 1
        fi
    fi
    
    echo_success "备份文件验证通过"
}

# 检查应用状态
check_app_status() {
    echo_info "检查应用状态..."
    
    # 检查 Node.js 进程
    if pgrep -f "node.*next" > /dev/null; then
        echo_warning "检测到 Next.js 应用正在运行"
        APP_RUNNING=true
    else
        echo_info "Next.js 应用未运行"
        APP_RUNNING=false
    fi
    
    # 检查 PM2 进程
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list 2>/dev/null | grep -q "online"; then
            echo_warning "检测到 PM2 管理的应用正在运行"
            PM2_RUNNING=true
        else
            PM2_RUNNING=false
        fi
    else
        PM2_RUNNING=false
    fi
    
    # 如果应用正在运行且未强制恢复，询问用户
    if [ "$APP_RUNNING" = true ] || [ "$PM2_RUNNING" = true ]; then
        if [ "$FORCE_RESTORE" = false ]; then
            echo_warning "应用正在运行，恢复过程中应停止应用以避免数据不一致"
            echo -n "是否继续？[y/N]: "
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                echo_info "恢复已取消"
                exit 0
            fi
        fi
        
        # 停止应用
        stop_application
    fi
}

# 停止应用
stop_application() {
    echo_info "停止应用服务..."
    
    # 停止 PM2 进程
    if [ "$PM2_RUNNING" = true ]; then
        pm2 stop all 2>/dev/null || true
        echo_info "PM2 应用已停止"
    fi
    
    # 停止 Node.js 进程
    if [ "$APP_RUNNING" = true ]; then
        pkill -f "node.*next" 2>/dev/null || true
        sleep 2
        echo_info "Node.js 应用已停止"
    fi
    
    echo_success "应用服务已停止"
}

# 启动应用
start_application() {
    echo_info "启动应用服务..."
    
    cd "$APP_DIR"
    
    # 如果之前使用 PM2，则使用 PM2 启动
    if [ "$PM2_RUNNING" = true ] && command -v pm2 >/dev/null 2>&1; then
        pm2 start ecosystem.config.js 2>/dev/null || pm2 start npm --name "listening-training-app" -- start
        echo_success "PM2 应用已启动"
    else
        echo_info "请手动启动应用：npm start 或 pm2 start"
    fi
}

# 创建当前数据备份
create_current_backup() {
    if [ "$CREATE_BACKUP" = true ]; then
        echo_info "创建当前数据备份..."
        
        local backup_script="$SCRIPT_DIR/backup.sh"
        if [ -f "$backup_script" ]; then
            chmod +x "$backup_script"
            "$backup_script" --compress || {
                echo_warning "当前数据备份失败，但恢复将继续"
            }
        else
            echo_warning "备份脚本不存在，跳过当前数据备份"
        fi
    else
        echo_info "跳过当前数据备份"
    fi
}

# 提取备份文件
extract_backup() {
    echo_info "提取备份文件..."
    
    # 创建临时目录
    mkdir -p "$TEMP_DIR"
    
    if [ "$BACKUP_TYPE" = "compressed" ]; then
        # 提取压缩文件
        tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR" || {
            echo_error "备份文件提取失败"
            cleanup_temp
            exit 1
        }
        
        # 找到提取的备份目录
        EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "backup_*" | head -n 1)
        if [ -z "$EXTRACTED_DIR" ]; then
            echo_error "备份文件中未找到有效的备份目录"
            cleanup_temp
            exit 1
        fi
    else
        # 复制目录
        cp -r "$BACKUP_FILE" "$TEMP_DIR/"
        EXTRACTED_DIR="$TEMP_DIR/$(basename "$BACKUP_FILE")"
    fi
    
    echo_success "备份文件提取完成: $EXTRACTED_DIR"
}

# 读取备份元数据
read_backup_metadata() {
    echo_info "读取备份元数据..."
    
    local metadata_file="$EXTRACTED_DIR/metadata.json"
    if [ -f "$metadata_file" ]; then
        echo_info "备份信息:"
        
        # 使用 jq 或简单的 grep 来读取元数据
        if command -v jq >/dev/null 2>&1; then
            local backup_date=$(jq -r '.backup_date' "$metadata_file" 2>/dev/null || echo "unknown")
            local app_version=$(jq -r '.app_version' "$metadata_file" 2>/dev/null || echo "unknown")
            local hostname=$(jq -r '.system_info.hostname' "$metadata_file" 2>/dev/null || echo "unknown")
            
            echo_info "  备份时间: $backup_date"
            echo_info "  应用版本: $app_version"
            echo_info "  源主机: $hostname"
        else
            echo_info "  $(head -n 10 "$metadata_file")"
        fi
        
        echo_success "备份元数据读取完成"
    else
        echo_warning "未找到备份元数据文件"
    fi
}

# 恢复数据库
restore_database() {
    echo_info "开始数据库恢复..."
    
    local db_backup_dir="$EXTRACTED_DIR/database"
    
    if [ -d "$db_backup_dir" ]; then
        # 确保数据目录存在
        mkdir -p "$DATA_DIR"
        
        # 恢复 SQLite 数据库
        if [ -f "$db_backup_dir/app.db" ]; then
            echo_info "恢复 SQLite 数据库..."
            
            # 备份现有数据库
            if [ -f "$DATA_DIR/app.db" ]; then
                mv "$DATA_DIR/app.db" "$DATA_DIR/app.db.restore_backup_$DATE" 2>/dev/null || true
            fi
            
            # 复制数据库文件
            cp "$db_backup_dir/app.db" "$DATA_DIR/" || {
                echo_error "数据库恢复失败"
                # 恢复原数据库
                [ -f "$DATA_DIR/app.db.restore_backup_$DATE" ] && mv "$DATA_DIR/app.db.restore_backup_$DATE" "$DATA_DIR/app.db"
                return 1
            }
            
            # 恢复 WAL 和 SHM 文件
            [ -f "$db_backup_dir/app.db-wal" ] && cp "$db_backup_dir/app.db-wal" "$DATA_DIR/" 2>/dev/null || true
            [ -f "$db_backup_dir/app.db-shm" ] && cp "$db_backup_dir/app.db-shm" "$DATA_DIR/" 2>/dev/null || true
            
            # 设置文件权限
            chmod 644 "$DATA_DIR/app.db" 2>/dev/null || true
            
            echo_success "SQLite 数据库恢复完成"
        else
            echo_warning "备份中未找到 SQLite 数据库文件"
        fi
        
        # 恢复 Prisma 数据库
        if [ -f "$db_backup_dir/prisma/app.db" ]; then
            echo_info "恢复 Prisma 数据库..."
            mkdir -p "$APP_DIR/prisma/data"
            cp "$db_backup_dir/prisma/app.db" "$APP_DIR/prisma/data/" || {
                echo_warning "Prisma 数据库恢复失败"
            }
            echo_success "Prisma 数据库恢复完成"
        fi
        
    else
        echo_warning "备份中未找到数据库文件"
    fi
}

# 恢复音频文件
restore_audio_files() {
    echo_info "开始音频文件恢复..."
    
    local audio_backup_dir="$EXTRACTED_DIR/audio"
    
    if [ -d "$audio_backup_dir" ] && [ -n "$(ls -A "$audio_backup_dir" 2>/dev/null)" ]; then
        # 确保音频目录存在
        mkdir -p "$AUDIO_DIR"
        
        # 备份现有音频文件
        if [ -n "$(ls -A "$AUDIO_DIR" 2>/dev/null)" ]; then
            local audio_backup_temp="$AUDIO_DIR.restore_backup_$DATE"
            mv "$AUDIO_DIR" "$audio_backup_temp" 2>/dev/null || true
            mkdir -p "$AUDIO_DIR"
        fi
        
        # 恢复音频文件
        cp -r "$audio_backup_dir"/* "$AUDIO_DIR/" 2>/dev/null || {
            echo_error "音频文件恢复失败"
            return 1
        }
        
        # 统计恢复的文件
        local restored_count=$(find "$AUDIO_DIR" -name "*.wav" | wc -l)
        local restored_size=$(du -sh "$AUDIO_DIR" 2>/dev/null | cut -f1)
        
        echo_success "音频文件恢复完成: $restored_count 个文件，总大小: $restored_size"
    else
        echo_info "备份中未找到音频文件"
    fi
}

# 恢复配置文件
restore_config_files() {
    echo_info "开始配置文件恢复..."
    
    local config_backup_dir="$EXTRACTED_DIR/config"
    
    if [ -d "$config_backup_dir" ]; then
        # 恢复环境变量（仅安全部分）
        if [ -f "$config_backup_dir/env_safe.txt" ]; then
            echo_info "找到环境配置备份（仅非敏感信息）"
            echo_info "请手动检查并合并到 .env.local 文件"
        fi
        
        # 恢复 Prisma 架构（仅供参考）
        if [ -f "$config_backup_dir/prisma/schema.prisma" ]; then
            echo_info "找到 Prisma 架构备份"
            echo_info "当前架构和备份架构可能需要手动比较"
        fi
        
        echo_success "配置文件恢复完成（需手动检查）"
    else
        echo_info "备份中未找到配置文件"
    fi
}

# 恢复日志文件
restore_logs() {
    echo_info "开始日志文件恢复..."
    
    local logs_backup_dir="$EXTRACTED_DIR/logs"
    
    if [ -d "$logs_backup_dir" ] && [ -n "$(ls -A "$logs_backup_dir" 2>/dev/null)" ]; then
        # 确保日志目录存在
        mkdir -p "$LOGS_DIR"
        
        # 恢复日志文件（添加后缀以避免覆盖）
        for log_file in "$logs_backup_dir"/*.log; do
            if [ -f "$log_file" ]; then
                local base_name=$(basename "$log_file" .log)
                cp "$log_file" "$LOGS_DIR/${base_name}_restored_$DATE.log" 2>/dev/null || true
            fi
        done
        
        echo_success "日志文件恢复完成（已添加时间戳后缀）"
    else
        echo_info "备份中未找到日志文件"
    fi
}

# 验证恢复结果
verify_restore_result() {
    if [ "$VERIFY_RESTORE" = true ]; then
        echo_info "验证恢复结果..."
        
        local errors=0
        
        # 检查数据库
        if [ -f "$DATA_DIR/app.db" ]; then
            if command -v sqlite3 >/dev/null 2>&1; then
                if sqlite3 "$DATA_DIR/app.db" "SELECT COUNT(*) FROM sqlite_master;" >/dev/null 2>&1; then
                    echo_success "数据库文件验证通过"
                else
                    echo_error "数据库文件验证失败"
                    errors=$((errors + 1))
                fi
            else
                echo_warning "无法验证数据库（sqlite3 不可用）"
            fi
        fi
        
        # 检查音频文件
        if [ -d "$AUDIO_DIR" ]; then
            local audio_count=$(find "$AUDIO_DIR" -name "*.wav" | wc -l)
            echo_info "音频文件数量: $audio_count"
        fi
        
        # 检查目录权限
        if [ ! -r "$DATA_DIR" ] || [ ! -w "$DATA_DIR" ]; then
            echo_error "数据目录权限检查失败"
            errors=$((errors + 1))
        fi
        
        if [ $errors -eq 0 ]; then
            echo_success "恢复结果验证通过"
        else
            echo_error "恢复结果验证发现 $errors 个问题"
            return 1
        fi
    else
        echo_info "跳过恢复结果验证"
    fi
}

# 清理临时文件
cleanup_temp() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        echo_info "临时文件清理完成"
    fi
}

# 主函数
main() {
    echo_info "开始数据恢复..."
    echo_info "========================================"
    echo_info "恢复时间: $(date)"
    echo_info "备份文件: $BACKUP_FILE"
    echo_info "应用目录: $APP_DIR"
    echo_info "========================================"
    
    # 验证备份文件
    validate_backup_file
    
    # 检查应用状态
    check_app_status
    
    # 创建当前数据备份
    create_current_backup
    
    # 提取备份文件
    extract_backup
    
    # 读取备份元数据
    read_backup_metadata
    
    # 最终确认
    if [ "$FORCE_RESTORE" = false ]; then
        echo_warning "即将开始恢复操作，这将覆盖现有数据"
        echo -n "确认继续？[y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo_info "恢复已取消"
            cleanup_temp
            exit 0
        fi
    fi
    
    # 执行恢复
    restore_database
    restore_audio_files
    restore_config_files
    restore_logs
    
    # 验证恢复结果
    verify_restore_result
    
    # 清理临时文件
    cleanup_temp
    
    # 启动应用
    if [ "$APP_RUNNING" = true ] || [ "$PM2_RUNNING" = true ]; then
        start_application
    fi
    
    echo_info "========================================"
    echo_success "数据恢复完成！"
    echo_info "数据库文件: $DATA_DIR/app.db"
    echo_info "音频文件: $AUDIO_DIR"
    echo_info "========================================"
    echo_warning "注意事项:"
    echo_warning "1. 请检查应用是否正常启动"
    echo_warning "2. 验证数据完整性和功能正常"
    echo_warning "3. 配置文件需要手动检查和合并"
    echo_warning "4. 如有问题，可从 *.restore_backup_$DATE 文件中恢复"
    echo_info "========================================"
}

# 错误处理
trap 'echo_error "恢复过程中发生错误，清理临时文件..."; cleanup_temp; exit 1' ERR

# 执行主函数
main "$@"