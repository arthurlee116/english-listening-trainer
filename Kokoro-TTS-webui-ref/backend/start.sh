#!/bin/bash

# Kokoro TTS Backend Startup Script

echo "🚀 Starting Kokoro TTS Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "🎙️ Starting Kokoro TTS server..."
echo "Backend will be available at: http://localhost:8000"
echo "API documentation at: http://localhost:8000/docs"
echo "Press Ctrl+C to stop the server"

# Start with optimized settings
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --timeout-keep-alive 120 --workers 1