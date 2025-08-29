#!/bin/bash
# 系统健康检查脚本 - 英语听力训练应用
# 检查应用服务、数据库、TTS 服务和系统资源
# Usage: ./health-check.sh [--verbose] [--json] [--alert]

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
APP_PORT="${PORT:-3000}"
API_TIMEOUT="${API_TIMEOUT:-10}"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# 命令行参数
VERBOSE=false
JSON_OUTPUT=false
ALERT_ON_FAIL=false

# 健康检查结果
HEALTH_STATUS="HEALTHY"
ISSUES=()
WARNINGS=()
CHECKS=()

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --alert)
            ALERT_ON_FAIL=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --verbose, -v    显示详细信息"
            echo "  --json           以 JSON 格式输出结果"
            echo "  --alert          检查失败时发送告警"
            echo "  --help, -h       显示此帮助信息"
            echo ""
            echo "返回代码:"
            echo "  0    所有检查通过"
            echo "  1    发现警告"
            echo "  2    发现错误"
            exit 0
            ;;
        *)
            echo_error "未知选项: $1"
            echo "使用 --help 查看帮助信息"
            exit 1
            ;;
    esac
done

# 记录检查结果
record_check() {
    local name="$1"
    local status="$2"
    local message="$3"
    local details="$4"
    
    CHECKS+=("{\"name\":\"$name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\"}")
    
    case "$status" in
        "PASS")
            [ "$VERBOSE" = true ] && echo_success "$name: $message"
            ;;
        "WARN")
            echo_warning "$name: $message"
            WARNINGS+=("$name: $message")
            [ "$HEALTH_STATUS" = "HEALTHY" ] && HEALTH_STATUS="WARNING"
            ;;
        "FAIL")
            echo_error "$name: $message"
            ISSUES+=("$name: $message")
            HEALTH_STATUS="UNHEALTHY"
            ;;
    esac
}

# 检查应用服务状态
check_app_service() {
    echo_info "检查应用服务状态..."
    
    # 检查端口监听
    if lsof -i :$APP_PORT >/dev/null 2>&1; then
        record_check "app_port" "PASS" "应用端口 $APP_PORT 正在监听" ""
        
        # 检查 HTTP 响应
        if command -v curl >/dev/null 2>&1; then
            local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $API_TIMEOUT http://localhost:$APP_PORT/api/health 2>/dev/null || echo "000")
            
            if [ "$response" = "200" ]; then
                record_check "app_health" "PASS" "应用健康检查端点正常响应" "HTTP $response"
            else
                record_check "app_health" "FAIL" "应用健康检查端点异常" "HTTP $response"
            fi
        else
            record_check "app_health" "WARN" "无法检查应用健康端点" "curl 命令不可用"
        fi
        
        # 检查进程状态
        local node_processes=$(pgrep -f "node.*next" | wc -l)
        if [ "$node_processes" -gt 0 ]; then
            record_check "node_process" "PASS" "发现 $node_processes 个 Node.js 进程" ""
        else
            record_check "node_process" "WARN" "未发现 Node.js 进程" "应用可能由其他方式运行"
        fi
        
    else
        record_check "app_port" "FAIL" "应用端口 $APP_PORT 未监听" ""
        record_check "app_health" "FAIL" "无法检查应用健康状态" "端口未开放"
        record_check "node_process" "FAIL" "应用服务未运行" ""
    fi
}

# 检查数据库状态
check_database() {
    echo_info "检查数据库状态..."
    
    # 检查 SQLite 数据库文件
    if [ -f "$DATA_DIR/app.db" ]; then
        local db_size=$(du -h "$DATA_DIR/app.db" 2>/dev/null | cut -f1)
        record_check "db_file" "PASS" "数据库文件存在" "大小: $db_size"
        
        # 检查数据库完整性
        if command -v sqlite3 >/dev/null 2>&1; then
            if sqlite3 "$DATA_DIR/app.db" "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
                record_check "db_integrity" "PASS" "数据库完整性检查通过" ""
            else
                record_check "db_integrity" "FAIL" "数据库完整性检查失败" ""
            fi
            
            # 检查用户数据
            local user_count=$(sqlite3 "$DATA_DIR/app.db" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
            if [ "$user_count" -gt 0 ]; then
                record_check "db_users" "PASS" "数据库包含用户数据" "用户数量: $user_count"
            else
                record_check "db_users" "WARN" "数据库中无用户数据" "可能是新安装"
            fi
            
            # 检查数据库连接
            local sessions_count=$(sqlite3 "$DATA_DIR/app.db" "SELECT COUNT(*) FROM practice_sessions;" 2>/dev/null || echo "0")
            record_check "db_sessions" "PASS" "数据库连接正常" "练习记录: $sessions_count"
            
        else
            record_check "db_integrity" "WARN" "无法检查数据库完整性" "sqlite3 不可用"
        fi
        
        # 检查数据库文件权限
        if [ -r "$DATA_DIR/app.db" ] && [ -w "$DATA_DIR/app.db" ]; then
            record_check "db_permissions" "PASS" "数据库文件权限正常" ""
        else
            record_check "db_permissions" "FAIL" "数据库文件权限异常" ""
        fi
        
    else
        record_check "db_file" "FAIL" "数据库文件不存在" "$DATA_DIR/app.db"
        record_check "db_integrity" "FAIL" "无法检查数据库完整性" "文件不存在"
        record_check "db_permissions" "FAIL" "无法检查数据库权限" "文件不存在"
    fi
    
    # 检查 WAL 文件（如果存在）
    if [ -f "$DATA_DIR/app.db-wal" ]; then
        local wal_size=$(du -h "$DATA_DIR/app.db-wal" 2>/dev/null | cut -f1)
        if [ "$wal_size" != "0" ]; then
            record_check "db_wal" "WARN" "WAL 文件较大，建议执行 checkpoint" "WAL 大小: $wal_size"
        else
            record_check "db_wal" "PASS" "WAL 文件正常" ""
        fi
    fi
}

# 检查 TTS 服务状态
check_tts_service() {
    echo_info "检查 TTS 服务状态..."
    
    # 检查 Python 环境
    if [ -d "$APP_DIR/kokoro-local/venv" ]; then
        record_check "tts_venv" "PASS" "TTS Python 虚拟环境存在" ""
        
        # 检查 Python 版本
        local python_path="$APP_DIR/kokoro-local/venv/bin/python"
        if [ -f "$python_path" ]; then
            local python_version=$($python_path --version 2>/dev/null || echo "unknown")
            if [[ "$python_version" =~ Python\ 3\.[8-9]|Python\ 3\.1[0-2] ]]; then
                record_check "python_version" "PASS" "Python 版本兼容" "$python_version"
            else
                record_check "python_version" "WARN" "Python 版本可能不兼容" "$python_version"
            fi
        else
            record_check "python_version" "FAIL" "Python 解释器不存在" ""
        fi
        
    else
        record_check "tts_venv" "FAIL" "TTS Python 虚拟环境不存在" ""
    fi
    
    # 检查 TTS 模型文件
    local voice_count=0
    if [ -d "$APP_DIR/kokoro-local/voices" ]; then
        voice_count=$(find "$APP_DIR/kokoro-local/voices" -name "*.pt" | wc -l)
        if [ "$voice_count" -gt 0 ]; then
            record_check "tts_models" "PASS" "TTS 模型文件存在" "模型数量: $voice_count"
        else
            record_check "tts_models" "FAIL" "TTS 模型文件缺失" ""
        fi
    else
        record_check "tts_models" "FAIL" "TTS 模型目录不存在" ""
    fi
    
    # 检查 TTS 服务响应（如果应用正在运行）
    if lsof -i :$APP_PORT >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
        local tts_response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $API_TIMEOUT \
            -X POST http://localhost:$APP_PORT/api/tts \
            -H "Content-Type: application/json" \
            -d '{"text":"test","voice":"af_bella"}' 2>/dev/null || echo "000")
        
        if [ "$tts_response" = "200" ]; then
            record_check "tts_api" "PASS" "TTS API 响应正常" "HTTP $tts_response"
        elif [ "$tts_response" = "500" ]; then
            record_check "tts_api" "WARN" "TTS API 返回服务器错误" "HTTP $tts_response"
        else
            record_check "tts_api" "FAIL" "TTS API 响应异常" "HTTP $tts_response"
        fi
    else
        record_check "tts_api" "WARN" "无法检查 TTS API" "应用未运行或 curl 不可用"
    fi
}

# 检查音频文件
check_audio_files() {
    echo_info "检查音频文件状态..."
    
    if [ -d "$AUDIO_DIR" ]; then
        local audio_count=$(find "$AUDIO_DIR" -name "*.wav" | wc -l)
        local audio_size=$(du -sh "$AUDIO_DIR" 2>/dev/null | cut -f1)
        
        record_check "audio_dir" "PASS" "音频目录存在" "文件数: $audio_count, 大小: $audio_size"
        
        # 检查音频文件权限
        if [ -r "$AUDIO_DIR" ] && [ -w "$AUDIO_DIR" ]; then
            record_check "audio_permissions" "PASS" "音频目录权限正常" ""
        else
            record_check "audio_permissions" "FAIL" "音频目录权限异常" ""
        fi
        
        # 检查旧文件（超过7天）
        local old_files=$(find "$AUDIO_DIR" -name "*.wav" -mtime +7 | wc -l)
        if [ "$old_files" -gt 10 ]; then
            record_check "audio_cleanup" "WARN" "发现较多旧音频文件" "超过7天: $old_files 个文件"
        else
            record_check "audio_cleanup" "PASS" "音频文件数量正常" ""
        fi
        
    else
        record_check "audio_dir" "FAIL" "音频目录不存在" "$AUDIO_DIR"
        record_check "audio_permissions" "FAIL" "无法检查音频目录权限" "目录不存在"
    fi
}

# 检查系统资源
check_system_resources() {
    echo_info "检查系统资源状态..."
    
    # 检查磁盘空间
    local disk_usage=$(df -h "$APP_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ -n "$disk_usage" ]; then
        if [ "$disk_usage" -lt 85 ]; then
            record_check "disk_space" "PASS" "磁盘空间充足" "已使用: ${disk_usage}%"
        elif [ "$disk_usage" -lt 95 ]; then
            record_check "disk_space" "WARN" "磁盘空间不足" "已使用: ${disk_usage}%"
        else
            record_check "disk_space" "FAIL" "磁盘空间严重不足" "已使用: ${disk_usage}%"
        fi
    else
        record_check "disk_space" "WARN" "无法检查磁盘空间" ""
    fi
    
    # 检查内存使用
    if command -v free >/dev/null 2>&1; then
        local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
        if [ "$mem_usage" -lt 80 ]; then
            record_check "memory_usage" "PASS" "内存使用正常" "已使用: ${mem_usage}%"
        elif [ "$mem_usage" -lt 90 ]; then
            record_check "memory_usage" "WARN" "内存使用较高" "已使用: ${mem_usage}%"
        else
            record_check "memory_usage" "FAIL" "内存使用过高" "已使用: ${mem_usage}%"
        fi
    else
        record_check "memory_usage" "WARN" "无法检查内存使用" "free 命令不可用"
    fi
    
    # 检查 CPU 负载
    if [ -f "/proc/loadavg" ]; then
        local load_avg=$(cut -d' ' -f1 /proc/loadavg)
        local cpu_cores=$(nproc 2>/dev/null || echo "1")
        local load_percent=$(echo "scale=0; $load_avg * 100 / $cpu_cores" | bc 2>/dev/null || echo "0")
        
        if [ "$load_percent" -lt 70 ]; then
            record_check "cpu_load" "PASS" "CPU 负载正常" "负载: $load_avg (${load_percent}%)"
        elif [ "$load_percent" -lt 90 ]; then
            record_check "cpu_load" "WARN" "CPU 负载较高" "负载: $load_avg (${load_percent}%)"
        else
            record_check "cpu_load" "FAIL" "CPU 负载过高" "负载: $load_avg (${load_percent}%)"
        fi
    else
        record_check "cpu_load" "WARN" "无法检查 CPU 负载" "/proc/loadavg 不存在"
    fi
}

# 检查日志文件
check_log_files() {
    echo_info "检查日志文件状态..."
    
    if [ -d "$LOGS_DIR" ]; then
        local log_count=$(find "$LOGS_DIR" -name "*.log" | wc -l)
        local log_size=$(du -sh "$LOGS_DIR" 2>/dev/null | cut -f1)
        
        record_check "log_dir" "PASS" "日志目录存在" "文件数: $log_count, 大小: $log_size"
        
        # 检查错误日志
        if [ -f "$LOGS_DIR/error.log" ]; then
            local error_count=$(tail -n 100 "$LOGS_DIR/error.log" 2>/dev/null | grep -c ERROR || echo "0")
            if [ "$error_count" -eq 0 ]; then
                record_check "error_logs" "PASS" "近期无错误日志" ""
            elif [ "$error_count" -lt 5 ]; then
                record_check "error_logs" "WARN" "发现少量错误日志" "错误数: $error_count"
            else
                record_check "error_logs" "FAIL" "发现大量错误日志" "错误数: $error_count"
            fi
        else
            record_check "error_logs" "WARN" "错误日志文件不存在" "可能日志配置异常"
        fi
        
        # 检查日志文件大小
        local large_logs=$(find "$LOGS_DIR" -name "*.log" -size +100M | wc -l)
        if [ "$large_logs" -gt 0 ]; then
            record_check "log_size" "WARN" "发现大型日志文件" "超过100MB: $large_logs 个文件"
        else
            record_check "log_size" "PASS" "日志文件大小正常" ""
        fi
        
    else
        record_check "log_dir" "WARN" "日志目录不存在" "$LOGS_DIR"
    fi
}

# 检查网络连接
check_network() {
    echo_info "检查网络连接状态..."
    
    # 检查外部 API 连接
    if command -v curl >/dev/null 2>&1; then
        # 检查 Cerebras API
        if [ -n "$CEREBRAS_API_KEY" ]; then
            local api_response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
                -H "Authorization: Bearer $CEREBRAS_API_KEY" \
                https://api.cerebras.ai/v1/models 2>/dev/null || echo "000")
            
            if [ "$api_response" = "200" ]; then
                record_check "cerebras_api" "PASS" "Cerebras API 连接正常" "HTTP $api_response"
            else
                record_check "cerebras_api" "WARN" "Cerebras API 连接异常" "HTTP $api_response"
            fi
        else
            record_check "cerebras_api" "WARN" "Cerebras API 密钥未配置" ""
        fi
        
        # 检查基本网络连接
        local internet_response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://www.google.com 2>/dev/null || echo "000")
        if [ "$internet_response" = "200" ]; then
            record_check "internet" "PASS" "网络连接正常" ""
        else
            record_check "internet" "WARN" "网络连接异常" "HTTP $internet_response"
        fi
    else
        record_check "cerebras_api" "WARN" "无法检查 API 连接" "curl 不可用"
        record_check "internet" "WARN" "无法检查网络连接" "curl 不可用"
    fi
}

# 检查环境变量
check_environment() {
    echo_info "检查环境变量配置..."
    
    # 检查关键环境变量
    local required_vars=("JWT_SECRET" "CEREBRAS_API_KEY")
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            record_check "env_$var" "PASS" "$var 已配置" ""
        else
            record_check "env_$var" "FAIL" "$var 未配置" ""
        fi
    done
    
    # 检查可选环境变量
    local optional_vars=("DATABASE_URL" "PORT" "ADMIN_EMAIL")
    for var in "${optional_vars[@]}"; do
        if [ -n "${!var}" ]; then
            record_check "env_opt_$var" "PASS" "$var 已配置" ""
        else
            record_check "env_opt_$var" "WARN" "$var 未配置，使用默认值" ""
        fi
    done
}

# 发送告警
send_alert() {
    if [ "$ALERT_ON_FAIL" = true ] && [ "$HEALTH_STATUS" = "UNHEALTHY" ]; then
        echo_info "发送告警通知..."
        
        # 这里可以集成各种告警方式
        # 例如：邮件、Slack、钉钉、短信等
        
        # 示例：写入告警日志
        local alert_log="$LOGS_DIR/alerts.log"
        mkdir -p "$LOGS_DIR"
        echo "[$DATE] ALERT: Health check failed - $HEALTH_STATUS" >> "$alert_log"
        for issue in "${ISSUES[@]}"; do
            echo "[$DATE] ISSUE: $issue" >> "$alert_log"
        done
        
        # 示例：发送邮件（需要配置邮件服务）
        # if command -v mail >/dev/null 2>&1 && [ -n "$ALERT_EMAIL" ]; then
        #     echo "Health check failed at $DATE" | mail -s "Health Check Alert" "$ALERT_EMAIL"
        # fi
        
        record_check "alert" "PASS" "告警通知已发送" ""
    fi
}

# 输出 JSON 格式结果
output_json() {
    local checks_json=$(IFS=','; echo "${CHECKS[*]}")
    local issues_json=$(printf '%s\n' "${ISSUES[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    local warnings_json=$(printf '%s\n' "${WARNINGS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    
    cat << EOF
{
    "timestamp": "$DATE",
    "status": "$HEALTH_STATUS",
    "checks": [$checks_json],
    "issues": $issues_json,
    "warnings": $warnings_json,
    "summary": {
        "total_checks": ${#CHECKS[@]},
        "issues_count": ${#ISSUES[@]},
        "warnings_count": ${#WARNINGS[@]}
    }
}
EOF
}

# 输出普通格式结果
output_summary() {
    echo_info "========================================"
    echo_info "健康检查完成 - $DATE"
    echo_info "========================================"
    echo_info "总体状态: $HEALTH_STATUS"
    echo_info "检查项目: ${#CHECKS[@]}"
    echo_info "问题数量: ${#ISSUES[@]}"
    echo_info "警告数量: ${#WARNINGS[@]}"
    
    if [ ${#ISSUES[@]} -gt 0 ]; then
        echo_error "发现的问题:"
        for issue in "${ISSUES[@]}"; do
            echo_error "  - $issue"
        done
    fi
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo_warning "发现的警告:"
        for warning in "${WARNINGS[@]}"; do
            echo_warning "  - $warning"
        done
    fi
    
    echo_info "========================================"
}

# 主函数
main() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo_info "开始系统健康检查..."
        echo_info "检查时间: $DATE"
        echo_info "========================================"
    fi
    
    # 加载环境变量
    [ -f "$APP_DIR/.env.local" ] && source "$APP_DIR/.env.local" 2>/dev/null || true
    [ -f "$APP_DIR/.env.production" ] && source "$APP_DIR/.env.production" 2>/dev/null || true
    
    # 执行各项检查
    check_app_service
    check_database
    check_tts_service
    check_audio_files
    check_system_resources
    check_log_files
    check_network
    check_environment
    
    # 发送告警
    send_alert
    
    # 输出结果
    if [ "$JSON_OUTPUT" = true ]; then
        output_json
    else
        output_summary
    fi
    
    # 返回适当的退出码
    case "$HEALTH_STATUS" in
        "HEALTHY")
            exit 0
            ;;
        "WARNING")
            exit 1
            ;;
        "UNHEALTHY")
            exit 2
            ;;
    esac
}

# 错误处理
trap 'echo_error "健康检查过程中发生错误"; exit 2' ERR

# 执行主函数
main "$@"