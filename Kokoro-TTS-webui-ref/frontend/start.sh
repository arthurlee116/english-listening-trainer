#!/bin/bash

# Kokoro TTS Frontend Startup Script

echo "🌐 Starting Kokoro TTS Frontend..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start a simple HTTP server
echo "🎙️ Starting frontend server..."
echo "Frontend will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop the server"

# Use Python's HTTP server (simple and reliable)
python3 -m http.server 3000