#!/bin/bash

# Kokoro TTS Backend Setup and Startup Script

echo "🎙️ Setting up Kokoro TTS Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Check if kokoro-main-ref exists
KOKORO_PATH="../../kokoro-main-ref"
if [ ! -d "$KOKORO_PATH" ]; then
    echo "❌ Error: kokoro-main-ref directory not found!"
    echo "Please make sure the kokoro-main-ref directory exists at ../../kokoro-main-ref"
    echo "Current directory: $(pwd)"
    echo "Parent directory contents:"
    ls -la ../../
    exit 1
fi

# Test imports
echo "🧪 Testing imports..."
python3 test_kokoro.py

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Please check the error messages above."
    exit 1
fi

echo ""
echo "🎙️ Starting Kokoro TTS server..."
echo "Backend will be available at: http://localhost:8000"
echo "API documentation at: http://localhost:8000/docs"
echo "Press Ctrl+C to stop the server"

# Start the server
python -m uvicorn main_simple:app --host 0.0.0.0 --port 8000 --reload --timeout-keep-alive 120 --workers 1