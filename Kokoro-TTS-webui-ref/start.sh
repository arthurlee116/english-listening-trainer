#!/bin/bash

# Kokoro TTS Web UI Main Startup Script

echo "🎙️ Kokoro TTS Web UI"
echo "===================="

# Make scripts executable
chmod +x backend/start.sh
chmod +x frontend/start.sh

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "🚀 Starting backend server..."
cd backend
./start.sh &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo "🌐 Starting frontend server..."
cd frontend
./start.sh &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Kokoro TTS Web UI is starting up..."
echo "🎙️ Backend API: http://localhost:8000"
echo "🌐 Frontend: http://localhost:3000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait