#!/bin/bash

# Kokoro TTS 本地环境设置脚本
# 为Apple Silicon M4优化，支持Metal加速

echo "🚀 Setting up local Kokoro TTS for Apple Silicon M4..."

# 检查系统
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script is optimized for macOS. Other systems may need manual adjustments."
fi

# 检查Python版本
PYTHON_VERSION=$(python3 --version 2>&1 | grep -o '[0-9]\+\.[0-9]\+' | head -1)
echo "🐍 Found Python $PYTHON_VERSION"

if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo "❌ Python 3.8 or higher is required"
    exit 1
fi

# 创建必要的目录
echo "📁 Creating directories..."
mkdir -p kokoro-local/voices
mkdir -p public/audio

# 检查语音文件（支持.pt和.bin格式）
if [ -f "kokoro-local/voices/af_heart.pt" ]; then
    echo "✅ Voice file 'af_heart.pt' already exists"
elif [ -f "kokoro-main-ref/kokoro.js/voices/af_heart.bin" ]; then
    cp kokoro-main-ref/kokoro.js/voices/af_heart.bin kokoro-local/voices/
    echo "✅ Voice file 'af_heart.bin' copied successfully"
elif [ -f "kokoro-main-ref/kokoro.js/voices/af_heart.pt" ]; then
    cp kokoro-main-ref/kokoro.js/voices/af_heart.pt kokoro-local/voices/
    echo "✅ Voice file 'af_heart.pt' copied successfully"
else
    echo "❌ Voice file not found. Please ensure the project structure is correct."
    echo "   Expected: kokoro-main-ref/kokoro.js/voices/af_heart.pt or af_heart.bin"
    exit 1
fi

# 检查espeak-ng
if ! command -v espeak-ng &> /dev/null; then
    echo "📦 Installing espeak-ng..."
    if command -v brew &> /dev/null; then
        brew install espeak-ng
    else
        echo "❌ Please install espeak-ng manually:"
        echo "   macOS: brew install espeak-ng"
        echo "   Ubuntu/Debian: sudo apt-get install espeak-ng"
        exit 1
    fi
else
    echo "✅ espeak-ng is already installed"
fi

# 设置Python虚拟环境
echo "🔧 Setting up Python virtual environment..."
cd kokoro-local

# 创建虚拟环境
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# 激活虚拟环境并安装依赖
echo "📦 Installing Python dependencies..."
source venv/bin/activate

# 升级pip
pip install --upgrade pip

# 安装PyTorch with MPS support (Apple Silicon)
echo "🔥 Installing PyTorch with Metal acceleration..."
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# 安装其他依赖
pip install -r requirements.txt

# 验证安装
echo "🧪 Testing installation..."
python3 -c "
import sys
sys.path.append('../kokoro-main-ref')
try:
    import torch
    print(f'✅ PyTorch {torch.__version__} installed')
    print(f'✅ MPS available: {torch.backends.mps.is_available()}')
    
    import soundfile
    print('✅ soundfile installed')
    
    import numpy
    print('✅ numpy installed')
    
    print('🎯 Testing Kokoro import...')
    from kokoro import KPipeline
    print('✅ Kokoro can be imported')
    
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'❌ Other error: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Kokoro TTS setup completed successfully!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Add environment variables to .env.local:"
    echo "      PYTORCH_ENABLE_MPS_FALLBACK=1"
    echo "   2. Run 'npm run dev' to start the application"
    echo "   3. The TTS service will initialize automatically"
    echo ""
    echo "📊 Expected performance:"
    echo "   • Model loading time: 3-5 seconds (on startup)"
    echo "   • Audio generation: 2-8 seconds (depending on text length)"
    echo "   • Memory usage: ~1-2GB"
    echo "   • Hardware acceleration: Metal (M4 GPU)"
else
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi