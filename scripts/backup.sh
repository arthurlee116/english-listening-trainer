#!/bin/bash
# 数据备份脚本 - 英语听力训练应用
# 备份数据库、音频文件和用户数据
# Usage: ./backup.sh [--remote] [--compress] [--cleanup]

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
BACKUP_DIR="${BACKUP_PATH:-$APP_DIR/backups}"
DATA_DIR="$APP_DIR/data"
AUDIO_DIR="$APP_DIR/public/audio"
LOGS_DIR="$APP_DIR/logs"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DATE}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# 远程备份配置（可选）
REMOTE_BACKUP=${REMOTE_BACKUP:-false}
S3_BUCKET="${S3_BUCKET:-}"
FTP_HOST="${FTP_HOST:-}"
FTP_USER="${FTP_USER:-}"
FTP_PASS="${FTP_PASS:-}"

# 解析命令行参数
ENABLE_REMOTE=false
ENABLE_COMPRESS=true
ENABLE_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --remote)
            ENABLE_REMOTE=true
            shift
            ;;
        --no-compress)
            ENABLE_COMPRESS=false
            shift
            ;;
        --cleanup)
            ENABLE_CLEANUP=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  --remote      启用远程备份"
            echo "  --no-compress 不压缩备份文件"
            echo "  --cleanup     清理旧备份文件"
            echo "  --help        显示此帮助信息"
            exit 0
            ;;
        *)
            echo_error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 检查权限
check_permissions() {
    echo_info "检查备份权限..."
    
    if [ ! -d "$APP_DIR" ]; then
        echo_error "应用目录不存在: $APP_DIR"
        exit 1
    fi
    
    if [ ! -r "$DATA_DIR" ]; then
        echo_error "无法读取数据目录: $DATA_DIR"
        exit 1
    fi
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    if [ ! -w "$BACKUP_DIR" ]; then
        echo_error "无法写入备份目录: $BACKUP_DIR"
        exit 1
    fi
    
    echo_success "权限检查通过"
}

# 检查应用状态
check_app_status() {
    echo_info "检查应用状态..."
    
    # 检查 Node.js 进程
    if pgrep -f "node.*next" > /dev/null; then
        echo_info "检测到 Next.js 应用正在运行"
        APP_RUNNING=true
    else
        echo_info "Next.js 应用未运行"
        APP_RUNNING=false
    fi
    
    # 检查 PM2 进程
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list | grep -q "online"; then
            echo_info "检测到 PM2 管理的应用正在运行"
            PM2_RUNNING=true
        else
            PM2_RUNNING=false
        fi
    else
        PM2_RUNNING=false
    fi
}

# 备份数据库
backup_database() {
    echo_info "开始数据库备份..."
    
    local db_backup_dir="$BACKUP_DIR/${BACKUP_NAME}/database"
    mkdir -p "$db_backup_dir"
    
    # 备份 SQLite 数据库
    if [ -f "$DATA_DIR/app.db" ]; then
        echo_info "备份 SQLite 数据库..."
        
        # 如果应用正在运行，先创建 WAL checkpoint
        if [ "$APP_RUNNING" = true ] && command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "$DATA_DIR/app.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
        fi
        
        # 复制数据库文件
        cp "$DATA_DIR/app.db" "$db_backup_dir/" || {
            echo_error "数据库备份失败"
            return 1
        }
        
        # 备份 WAL 和 SHM 文件（如果存在）
        [ -f "$DATA_DIR/app.db-wal" ] && cp "$DATA_DIR/app.db-wal" "$db_backup_dir/" 2>/dev/null || true
        [ -f "$DATA_DIR/app.db-shm" ] && cp "$DATA_DIR/app.db-shm" "$db_backup_dir/" 2>/dev/null || true
        
        echo_success "SQLite 数据库备份完成"
    else
        echo_warning "未找到 SQLite 数据库文件"
    fi
    
    # 备份 Prisma 数据库（如果存在）
    if [ -f "$APP_DIR/prisma/data/app.db" ]; then
        echo_info "备份 Prisma 数据库..."
        mkdir -p "$db_backup_dir/prisma"
        cp "$APP_DIR/prisma/data/app.db" "$db_backup_dir/prisma/" || {
            echo_warning "Prisma 数据库备份失败"
        }
        echo_success "Prisma 数据库备份完成"
    fi
    
    # 导出数据库架构
    if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DATA_DIR/app.db" ]; then
        echo_info "导出数据库架构..."
        sqlite3 "$DATA_DIR/app.db" ".schema" > "$db_backup_dir/schema.sql" 2>/dev/null || {
            echo_warning "数据库架构导出失败"
        }
        echo_success "数据库架构导出完成"
    fi
    
    # 导出用户数据统计
    if [ -f "$DATA_DIR/app.db" ] && command -v sqlite3 >/dev/null 2>&1; then
        echo_info "导出用户数据统计..."
        sqlite3 "$DATA_DIR/app.db" << 'EOF' > "$db_backup_dir/stats.txt" 2>/dev/null || true
.mode column
.headers on
SELECT 'Total Users' as metric, COUNT(*) as value FROM users;
SELECT 'Total Practice Sessions' as metric, COUNT(*) as value FROM practice_sessions;
SELECT 'Database File Size (MB)' as metric, ROUND(page_count * page_size / 1024.0 / 1024.0, 2) as value FROM pragma_page_count(), pragma_page_size();
EOF
        echo_success "用户数据统计导出完成"
    fi
}

# 备份音频文件
backup_audio_files() {
    echo_info "开始音频文件备份..."
    
    local audio_backup_dir="$BACKUP_DIR/${BACKUP_NAME}/audio"
    mkdir -p "$audio_backup_dir"
    
    if [ -d "$AUDIO_DIR" ] && [ -n "$(ls -A "$AUDIO_DIR" 2>/dev/null)" ]; then
        echo_info "备份音频文件..."
        
        # 统计音频文件
        local audio_count=$(find "$AUDIO_DIR" -name "*.wav" | wc -l)
        local audio_size=$(du -sh "$AUDIO_DIR" 2>/dev/null | cut -f1)
        
        echo_info "找到 $audio_count 个音频文件，总大小: $audio_size"
        
        # 复制音频文件
        cp -r "$AUDIO_DIR"/* "$audio_backup_dir/" 2>/dev/null || {
            echo_warning "部分音频文件备份失败"
        }
        
        # 创建音频文件清单
        find "$AUDIO_DIR" -name "*.wav" -exec ls -lh {} \; > "$audio_backup_dir/file_list.txt" 2>/dev/null || true
        
        echo_success "音频文件备份完成"
    else
        echo_info "未找到音频文件或目录为空"
        touch "$audio_backup_dir/.empty"
    fi
}

# 备份配置文件
backup_config_files() {
    echo_info "开始配置文件备份..."
    
    local config_backup_dir="$BACKUP_DIR/${BACKUP_NAME}/config"
    mkdir -p "$config_backup_dir"
    
    # 备份环境变量文件（不包含敏感信息）
    if [ -f "$APP_DIR/.env.local" ]; then
        echo_info "备份环境配置..."
        # 过滤敏感信息
        grep -v -E "(API_KEY|SECRET|PASSWORD|TOKEN)" "$APP_DIR/.env.local" > "$config_backup_dir/env_safe.txt" 2>/dev/null || true
    fi
    
    # 备份 package.json
    if [ -f "$APP_DIR/package.json" ]; then
        cp "$APP_DIR/package.json" "$config_backup_dir/" 2>/dev/null || true
    fi
    
    # 备份 Prisma 架构
    if [ -f "$APP_DIR/prisma/schema.prisma" ]; then
        mkdir -p "$config_backup_dir/prisma"
        cp "$APP_DIR/prisma/schema.prisma" "$config_backup_dir/prisma/" 2>/dev/null || true
    fi
    
    # 备份 Next.js 配置
    if [ -f "$APP_DIR/next.config.mjs" ]; then
        cp "$APP_DIR/next.config.mjs" "$config_backup_dir/" 2>/dev/null || true
    fi
    
    echo_success "配置文件备份完成"
}

# 备份日志文件（最近7天）
backup_logs() {
    echo_info "开始日志文件备份..."
    
    local logs_backup_dir="$BACKUP_DIR/${BACKUP_NAME}/logs"
    mkdir -p "$logs_backup_dir"
    
    if [ -d "$LOGS_DIR" ]; then
        # 只备份最近的日志文件
        find "$LOGS_DIR" -name "*.log" -mtime -7 -exec cp {} "$logs_backup_dir/" \; 2>/dev/null || true
        
        # 创建日志统计
        if [ -n "$(ls -A "$logs_backup_dir" 2>/dev/null)" ]; then
            ls -lh "$logs_backup_dir" > "$logs_backup_dir/log_summary.txt" 2>/dev/null || true
            echo_success "日志文件备份完成"
        else
            echo_info "未找到最近的日志文件"
            touch "$logs_backup_dir/.empty"
        fi
    else
        echo_info "日志目录不存在"
        touch "$logs_backup_dir/.empty"
    fi
}

# 创建备份元数据
create_backup_metadata() {
    echo_info "创建备份元数据..."
    
    local metadata_file="$BACKUP_DIR/${BACKUP_NAME}/metadata.json"
    
    cat > "$metadata_file" << EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_name": "$BACKUP_NAME",
    "app_version": "$(cd "$APP_DIR" && npm list --depth=0 2>/dev/null | head -n 1 | cut -d' ' -f1 || echo 'unknown')",
    "node_version": "$(node --version 2>/dev/null || echo 'unknown')",
    "system_info": {
        "hostname": "$(hostname)",
        "os": "$(uname -s)",
        "arch": "$(uname -m)",
        "uptime": "$(uptime)"
    },
    "backup_components": {
        "database": $([ -f "$BACKUP_DIR/${BACKUP_NAME}/database/app.db" ] && echo "true" || echo "false"),
        "audio_files": $([ -n "$(ls -A "$BACKUP_DIR/${BACKUP_NAME}/audio" 2>/dev/null)" ] && echo "true" || echo "false"),
        "config_files": $([ -n "$(ls -A "$BACKUP_DIR/${BACKUP_NAME}/config" 2>/dev/null)" ] && echo "true" || echo "false"),
        "logs": $([ -n "$(ls -A "$BACKUP_DIR/${BACKUP_NAME}/logs" 2>/dev/null)" ] && echo "true" || echo "false")
    },
    "file_counts": {
        "database_files": $(find "$BACKUP_DIR/${BACKUP_NAME}/database" -type f 2>/dev/null | wc -l),
        "audio_files": $(find "$BACKUP_DIR/${BACKUP_NAME}/audio" -name "*.wav" 2>/dev/null | wc -l),
        "config_files": $(find "$BACKUP_DIR/${BACKUP_NAME}/config" -type f 2>/dev/null | wc -l),
        "log_files": $(find "$BACKUP_DIR/${BACKUP_NAME}/logs" -name "*.log" 2>/dev/null | wc -l)
    }
}
EOF
    
    echo_success "备份元数据创建完成"
}

# 压缩备份文件
compress_backup() {
    if [ "$ENABLE_COMPRESS" = true ]; then
        echo_info "压缩备份文件..."
        
        cd "$BACKUP_DIR"
        tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME" 2>/dev/null || {
            echo_error "备份文件压缩失败"
            return 1
        }
        
        # 删除未压缩的目录
        rm -rf "$BACKUP_NAME"
        
        # 显示压缩后的文件大小
        local compressed_size=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
        echo_success "备份文件压缩完成，大小: $compressed_size"
        
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    else
        echo_info "跳过压缩，保留目录格式"
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}"
    fi
}

# 远程备份
upload_to_remote() {
    if [ "$ENABLE_REMOTE" = true ]; then
        echo_info "开始远程备份..."
        
        # S3 备份
        if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
            echo_info "上传到 S3: $S3_BUCKET"
            aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/" --storage-class STANDARD_IA 2>/dev/null || {
                echo_error "S3 上传失败"
                return 1
            }
            echo_success "S3 备份完成"
        fi
        
        # FTP 备份
        if [ -n "$FTP_HOST" ] && [ -n "$FTP_USER" ] && command -v lftp >/dev/null 2>&1; then
            echo_info "上传到 FTP: $FTP_HOST"
            lftp -c "open -u $FTP_USER,$FTP_PASS $FTP_HOST; put '$BACKUP_FILE' -o backups/$(basename "$BACKUP_FILE")" 2>/dev/null || {
                echo_error "FTP 上传失败"
                return 1
            }
            echo_success "FTP 备份完成"
        fi
        
        if [ -z "$S3_BUCKET" ] && [ -z "$FTP_HOST" ]; then
            echo_warning "未配置远程备份服务"
        fi
    else
        echo_info "跳过远程备份"
    fi
}

# 清理旧备份
cleanup_old_backups() {
    if [ "$ENABLE_CLEANUP" = true ]; then
        echo_info "清理旧备份文件..."
        
        # 删除超过保留期的备份文件
        find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        find "$BACKUP_DIR" -name "backup_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
        
        # 统计剩余备份文件
        local remaining_backups=$(find "$BACKUP_DIR" -name "backup_*" | wc -l)
        echo_success "清理完成，保留 $remaining_backups 个备份文件"
    else
        echo_info "跳过清理旧备份（使用 --cleanup 启用）"
    fi
}

# 验证备份完整性
verify_backup() {
    echo_info "验证备份完整性..."
    
    if [ "$ENABLE_COMPRESS" = true ]; then
        # 验证压缩文件
        if tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
            echo_success "备份文件完整性验证通过"
        else
            echo_error "备份文件损坏！"
            return 1
        fi
    else
        # 验证目录结构
        if [ -d "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE/metadata.json" ]; then
            echo_success "备份目录完整性验证通过"
        else
            echo_error "备份目录结构不完整！"
            return 1
        fi
    fi
}

# 主函数
main() {
    echo_info "开始数据备份..."
    echo_info "========================================"
    echo_info "备份时间: $(date)"
    echo_info "备份目录: $BACKUP_DIR"
    echo_info "备份名称: $BACKUP_NAME"
    echo_info "========================================"
    
    # 检查权限和状态
    check_permissions
    check_app_status
    
    # 执行备份
    backup_database
    backup_audio_files
    backup_config_files
    backup_logs
    create_backup_metadata
    
    # 压缩备份
    compress_backup
    
    # 验证备份
    verify_backup
    
    # 远程备份
    upload_to_remote
    
    # 清理旧备份
    cleanup_old_backups
    
    echo_info "========================================"
    echo_success "备份完成！"
    echo_info "备份文件: $BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        local backup_size=$(du -sh "$BACKUP_FILE" | cut -f1)
        echo_info "备份大小: $backup_size"
    fi
    
    echo_info "使用以下命令恢复备份："
    echo_info "  ./scripts/restore.sh '$BACKUP_FILE'"
    echo_info "========================================"
}

# 错误处理
trap 'echo_error "备份过程中发生错误，清理临时文件..."; rm -rf "$BACKUP_DIR/${BACKUP_NAME}" 2>/dev/null; exit 1' ERR

# 执行主函数
main "$@"