#!/bin/bash

# ============================================
# Kokoro TTS 完整安装和配置脚本
# 支持 CPU 和 CUDA 加速
# ============================================

set -e  # 遇到错误立即退出

TORCH_VARIANT="${KOKORO_TORCH_VARIANT:-auto}"
TORCH_INDEX_URL="${KOKORO_TORCH_INDEX_URL:-}"
TORCH_PACKAGES="${KOKORO_TORCH_PACKAGES:-torch torchaudio torchvision}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# 检测CUDA是否可用
detect_cuda() {
    if command_exists nvidia-smi; then
        if nvidia-smi --query-gpu=name --format=csv,noheader,nounits | grep -q .; then
            echo "true"
            return
        fi
    fi
    echo "false"
}

# 下载文件函数
download_file() {
    local url="$1"
    local output="$2"

    if command_exists wget; then
        wget -O "$output" "$url"
    elif command_exists curl; then
        curl -L -o "$output" "$url"
    else
        print_error "Neither wget nor curl is available. Please install one of them."
        exit 1
    fi
}

# 主函数
main() {
    print_header "Kokoro TTS 完整安装脚本"
    print_info "开始安装和配置 Kokoro TTS..."

    local OS=$(detect_os)
    local HAS_CUDA=$(detect_cuda)
    local SELECTED_VARIANT="$TORCH_VARIANT"

    print_info "检测到的操作系统: $OS"
    print_info "CUDA 可用: $HAS_CUDA"

    if [[ "$SELECTED_VARIANT" == "auto" ]]; then
        if [[ -n "${KOKORO_DEVICE:-}" ]]; then
            SELECTED_VARIANT="${KOKORO_DEVICE,,}"
        elif [[ "$HAS_CUDA" == "true" ]]; then
            SELECTED_VARIANT="cuda"
        elif [[ "$OS" == "macos" ]]; then
            SELECTED_VARIANT="mps"
        else
            SELECTED_VARIANT="cpu"
        fi
    fi

    # 步骤1: 检查Python
    print_header "步骤 1: 检查 Python 环境"
    if ! command_exists python3; then
        print_error "Python3 未找到，请先安装 Python 3.8+"
        exit 1
    fi

    local PYTHON_VERSION=$(python3 --version 2>&1 | grep -o '[0-9]\+\.[0-9]\+' | head -1)
    print_info "Python 版本: $PYTHON_VERSION"

    if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
        print_error "需要 Python 3.8 或更高版本"
        exit 1
    fi
    print_success "Python 版本检查通过"

    # 步骤2: 创建目录结构
    print_header "步骤 2: 创建目录结构"
    mkdir -p kokoro-local/voices
    mkdir -p kokoro-main-ref/kokoro.js
    mkdir -p public/audio
    print_success "目录结构创建完成"

    # 步骤3: 下载 Kokoro 模型
    print_header "步骤 3: 下载 Kokoro 模型和语音文件"

    # 下载主仓库
    if [ ! -d "kokoro-main-ref/kokoro.js/.git" ]; then
        print_info "下载 Kokoro 主仓库..."
        if command_exists git; then
            cd kokoro-main-ref
            if git clone https://github.com/hexgrad/kokoro.git kokoro.js 2>/dev/null; then
                print_success "Kokoro 仓库克隆成功"
            else
                print_warning "Git 克隆失败，尝试直接下载"
                cd kokoro.js
                download_file "https://github.com/hexgrad/kokoro/archive/refs/heads/main.zip" "kokoro-main.zip"
                unzip kokoro-main.zip
                mv kokoro-main/* ./
                rm -rf kokoro-main kokoro-main.zip
                print_success "Kokoro 仓库下载成功"
            fi
            cd ../..
        else
            print_error "Git 未找到，请安装 git 或手动下载 kokoro 仓库"
            exit 1
        fi
    else
        print_success "Kokoro 仓库已存在"
    fi

    # 下载语音文件
    if [ ! -f "kokoro-local/voices/af_heart.pt" ] && [ ! -f "kokoro-local/voices/af_heart.bin" ]; then
        print_info "下载语音文件..."
        if [ -f "kokoro-main-ref/kokoro.js/voices/af_heart.pt" ]; then
            cp kokoro-main-ref/kokoro.js/voices/af_heart.pt kokoro-local/voices/
            print_success "语音文件复制成功"
        elif [ -f "kokoro-main-ref/kokoro.js/voices/af_heart.bin" ]; then
            cp kokoro-main-ref/kokoro.js/voices/af_heart.bin kokoro-local/voices/
            print_success "语音文件复制成功"
        else
            print_warning "未找到语音文件，尝试从网络下载..."
            # 这里可以添加从网络下载语音文件的逻辑
            print_warning "请手动确保语音文件存在于 kokoro-local/voices/ 目录中"
        fi
    else
        print_success "语音文件已存在"
    fi

    # 步骤4: 检查系统依赖
    print_header "步骤 4: 检查系统依赖"

    # 检查 espeak-ng
    if ! command_exists espeak-ng; then
        print_info "安装 espeak-ng..."
        case $OS in
            "linux")
                if command_exists apt; then
                    sudo apt update && sudo apt install -y espeak-ng
                elif command_exists yum; then
                    sudo yum install -y espeak-ng
                elif command_exists dnf; then
                    sudo dnf install -y espeak-ng
                else
                    print_error "请手动安装 espeak-ng"
                    exit 1
                fi
                ;;
            "macos")
                if command_exists brew; then
                    brew install espeak-ng
                else
                    print_error "请手动安装 Homebrew 并运行: brew install espeak-ng"
                    exit 1
                fi
                ;;
            *)
                print_error "不支持的操作系统，请手动安装 espeak-ng"
                exit 1
                ;;
        esac
        print_success "espeak-ng 安装完成"
    else
        print_success "espeak-ng 已安装"
    fi

    # 步骤5: 设置Python虚拟环境
    print_header "步骤 5: 设置 Python 虚拟环境"
    cd kokoro-local

    if [ ! -d "venv" ]; then
        print_info "创建虚拟环境..."
        python3 -m venv venv
        print_success "虚拟环境创建成功"
    else
        print_success "虚拟环境已存在"
    fi

    # 激活虚拟环境
    source venv/bin/activate
    print_info "虚拟环境已激活"

    # 升级 pip
    pip install --upgrade pip

    # 步骤6: 安装Python依赖
    print_header "步骤 6: 安装 Python 依赖"

    print_info "选择的 PyTorch 变体: $SELECTED_VARIANT"
    if python -c "import torch" >/dev/null 2>&1; then
        print_info "虚拟环境中已检测到 PyTorch，跳过安装"
    else
        local index
        case "$SELECTED_VARIANT" in
            cuda)
                index="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu118}"
                print_info "使用 CUDA 轮子 (index: $index) 安装 PyTorch"
                pip install --index-url "$index" $TORCH_PACKAGES
                ;;
            mps)
                index="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cpu}"
                print_info "使用 CPU/MPS 轮子 (index: $index) 安装 PyTorch"
                pip install --index-url "$index" $TORCH_PACKAGES
                ;;
            cpu|*)
                index="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cpu}"
                print_info "安装 CPU 版本的 PyTorch (index: $index)"
                pip install --index-url "$index" $TORCH_PACKAGES
                ;;
        esac
        print_success "PyTorch 安装完成"
    fi

    # 安装其他依赖
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        print_success "依赖安装完成"
    else
        print_error "requirements.txt 文件不存在"
        exit 1
    fi

    # 步骤7: 配置环境变量
    print_header "步骤 7: 配置环境变量"

    cd ..

    # 创建或更新 .env.local 文件
    ENV_FILE=".env.local"
    if [ ! -f "$ENV_FILE" ]; then
        touch "$ENV_FILE"
    fi

    # 添加必要的环境变量
    if ! grep -q "PYTORCH_ENABLE_MPS_FALLBACK" "$ENV_FILE"; then
        echo "PYTORCH_ENABLE_MPS_FALLBACK=1" >> "$ENV_FILE"
    fi

    if ! grep -q "KOKORO_DEVICE" "$ENV_FILE"; then
        case "$SELECTED_VARIANT" in
            cuda)
                echo "KOKORO_DEVICE=cuda" >> "$ENV_FILE"
                ;;
            mps)
                echo "KOKORO_DEVICE=mps" >> "$ENV_FILE"
                ;;
            cpu|*)
                echo "KOKORO_DEVICE=auto" >> "$ENV_FILE"
                ;;
        esac
    fi

    if ! grep -q "KOKORO_TTS_MAX_CONCURRENCY" "$ENV_FILE"; then
        echo "KOKORO_TTS_MAX_CONCURRENCY=2" >> "$ENV_FILE"
    fi

    print_success "环境变量配置完成"

    # 步骤8: 验证安装
    print_header "步骤 8: 验证安装"

    cd kokoro-local
    source venv/bin/activate

    print_info "测试 Python 导入..."
    python3 -c "
import sys
sys.path.append('../kokoro-main-ref')

try:
    import torch
    print('✅ PyTorch', torch.__version__, 'installed')

    if torch.cuda.is_available():
        print('✅ CUDA available:', torch.cuda.get_device_name(0))
    else:
        print('ℹ️  CUDA not available, using CPU')

    if torch.backends.mps.is_available():
        print('✅ Metal Performance Shaders (MPS) available')
    else:
        print('ℹ️  MPS not available')

    import soundfile
    print('✅ soundfile installed')

    import numpy as np
    print('✅ numpy installed')

    print('🎯 Testing Kokoro import...')
    from kokoro import KPipeline
    print('✅ Kokoro can be imported')

    # 尝试创建pipeline
    print('🔧 Testing pipeline creation...')
    pipeline = KPipeline(lang_code='a')
    print('✅ Pipeline created successfully')

    print('')
    print('🎉 All tests passed!')

except ImportError as e:
    print('❌ Import error:', str(e))
    sys.exit(1)
except Exception as e:
    print('❌ Other error:', str(e))
    sys.exit(1)
"

    if [ $? -eq 0 ]; then
        cd ..
        print_header "安装完成!"
        echo ""
        echo "🎉 Kokoro TTS 安装和配置完成!"
        echo ""
        echo "📋 接下来:"
        echo "   1. 运行 'npm install' 安装 Node.js 依赖"
        echo "   2. 运行 'npm run dev' 启动应用程序"
        echo "   3. TTS 服务将自动初始化"
        echo ""
        echo "⚡ 性能预期:"
        if [ "$HAS_CUDA" = "true" ]; then
            echo "   • 硬件加速: CUDA GPU"
            echo "   • 模型加载: 2-4秒"
            echo "   • 音频生成: 1-5秒 (取决于文本长度)"
        else
            echo "   • 硬件加速: CPU"
            echo "   • 模型加载: 3-6秒"
            echo "   • 音频生成: 2-10秒 (取决于文本长度)"
        fi
        echo "   • 内存使用: ~1-2GB"
        echo ""
        echo "📁 重要文件:"
        echo "   • 配置文件: .env.local"
        echo "   • 模型文件: kokoro-main-ref/kokoro.js/"
        echo "   • 语音文件: kokoro-local/voices/"
        echo "   • Python环境: kokoro-local/venv/"
    else
        cd ..
        print_error "验证失败，请检查上述错误信息"
        exit 1
    fi
}

# 运行主函数
main "$@"
