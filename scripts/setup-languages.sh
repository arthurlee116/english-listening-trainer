#!/bin/bash

# Setup script for multilingual support
# Downloads voice files for all supported languages

set -e

echo "🚀 Setting up multilingual voice support..."

# Create voices directory if it doesn't exist
mkdir -p kokoro-local/voices

# Voice files to download (best quality for each language)
VOICES=(
    "af_bella:American English - Bella (A- grade)"
    "af_heart:American English - Heart (A grade)" 
    "af_nicole:American English - Nicole (B- grade)"
    "bf_emma:British English - Emma (B- grade)"
    "ef_dora:Spanish - Dora"
    "ff_siwis:French - Siwis (B- grade)"
    "jf_alpha:Japanese - Alpha (C+ grade)"
    "if_sara:Italian - Sara"
    "pf_dora:Portuguese Brazil - Dora"
    "hf_alpha:Hindi - Alpha"
)

# Base URL for voice files
BASE_URL="https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices"

# Download function
download_voice() {
    local voice_name=$1
    local description=$2
    local file_path="kokoro-local/voices/${voice_name}.pt"
    
    if [ -f "$file_path" ]; then
        echo "✅ ${voice_name}.pt already exists"
        return 0
    fi
    
    echo "📥 Downloading ${voice_name}.pt - ${description}"
    
    # Try wget first, fallback to curl
    if command -v wget >/dev/null 2>&1; then
        wget -q --show-progress -O "$file_path" "${BASE_URL}/${voice_name}.pt" || {
            echo "❌ Failed to download ${voice_name}.pt"
            rm -f "$file_path"
            return 1
        }
    elif command -v curl >/dev/null 2>&1; then
        curl -L -o "$file_path" "${BASE_URL}/${voice_name}.pt" || {
            echo "❌ Failed to download ${voice_name}.pt"
            rm -f "$file_path"
            return 1
        }
    else
        echo "❌ Neither wget nor curl is available"
        return 1
    fi
    
    echo "✅ Downloaded ${voice_name}.pt"
}

# Download all voice files
echo "📁 Downloading voice files..."
for voice_entry in "${VOICES[@]}"; do
    voice_name="${voice_entry%%:*}"
    description="${voice_entry#*:}"
    download_voice "$voice_name" "$description"
done

# Install additional Python dependencies if needed
echo "🐍 Checking Python dependencies..."
cd kokoro-local

# Activate virtual environment
source venv/bin/activate

# Install Japanese support if not already installed
echo "📦 Installing Japanese language support..."
pip install "misaki[ja]" --quiet || echo "⚠️  Japanese support installation failed"

# Check if espeak-ng is available (needed for some languages)
if ! command -v espeak-ng >/dev/null 2>&1; then
    echo "⚠️  espeak-ng not found. Some languages may not work properly."
    echo "   On macOS: brew install espeak-ng"
    echo "   On Ubuntu: sudo apt-get install espeak-ng"
fi

echo "🎉 Multilingual setup complete!"
echo ""
echo "📊 Voice files status:"
ls -la voices/*.pt | awk '{print "  " $9 " - " int($5/1024) "KB"}' 2>/dev/null || echo "  No voice files found"

echo ""
echo "🔍 To test a specific language:"
echo "  cd kokoro-local"
echo "  source venv/bin/activate" 
echo "  python kokoro_wrapper.py --test"