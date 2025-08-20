# Kokoro TTS Web UI

A web interface for Kokoro TTS model based on the official implementation.

## 🚀 Quick Start

### Prerequisites

- Python 3.10 or higher
- Node.js (for frontend development, optional)
- Kokoro-main-ref repository (should be in the parent directory)

### Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Run the setup and start script:**
   ```bash
   chmod +x setup_and_start.sh
   ./setup_and_start.sh
   ```

3. **Alternatively, manual setup:**
   ```bash
   # Create virtual environment
   python3 -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Test imports
   python3 test_kokoro.py
   
   # Start server
   python -m uvicorn main_simple:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Start the frontend:**
   ```bash
   cd frontend
   python3 -m http.server 3000
   ```

5. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 📁 Project Structure

```
Kokoro-TTS-webui/
├── backend/                 # FastAPI backend
│   ├── main.py            # Main backend with full features
│   ├── main_simple.py     # Simplified backend for testing
│   ├── requirements.txt   # Python dependencies
│   ├── test_kokoro.py     # Test script for imports
│   ├── setup_and_start.sh # Setup and startup script
│   └── start.sh          # Quick startup script
├── frontend/               # HTML/JS frontend
│   ├── index.html        # Main web interface
│   └── start.sh          # Frontend startup script
├── model/                 # Model files (empty by default)
├── README.md             # This file
└── start.sh              # Main startup script
```

## 🎯 Features

- **Text-to-Speech**: Convert text to natural-sounding speech
- **Multiple Voices**: Support for 25+ different voices
- **Language Support**: American English and British English
- **Speed Control**: Adjust speech speed from 0.5x to 2.0x
- **Real-time Generation**: Stream audio as it's generated
- **Web Interface**: Easy-to-use web interface
- **API Access**: RESTful API for integration

## 🔧 Backend API

### Endpoints

- `GET /` - Health check
- `GET /voices` - Get available voices
- `POST /tts` - Generate speech
- `POST /tts/stream` - Generate streaming speech

### Request Format

```json
{
    "text": "Hello, this is a test.",
    "voice": "af_heart",
    "speed": 1.0,
    "lang_code": "a",
    "sample_rate": 24000
}
```

### Available Voices

#### American English (lang_code: "a")
- Female: af_heart, af_bella, af_nicole, af_sarah, af_nova, af_sky, af_alloy, af_jessica, af_river
- Male: am_michael, am_echo, am_eric, am_liam, am_onyx, am_santa, am_adam

#### British English (lang_code: "b")
- Female: bf_emma, bf_isabella, bf_alice, bf_lily
- Male: bm_george, bm_fable, bm_lewis, bm_daniel

## 🌐 Frontend

The web interface provides:
- Text input area
- Voice selection dropdown
- Language selection
- Speed control slider
- Audio playback
- Download functionality

## 🛠️ Development

### Backend Development

```bash
cd backend
source venv/bin/activate
python -m uvicorn main_simple:app --reload
```

### Frontend Development

```bash
cd frontend
python3 -m http.server 3000
```

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**: Make sure kokoro-main-ref is in the correct location
2. **Voice Loading Issues**: Some voices may not be available without proper voice files
3. **Memory Issues**: Kokoro model requires sufficient RAM
4. **Port Conflicts**: Make sure ports 8000 and 3000 are available

### Testing

Run the test script to verify setup:
```bash
cd backend
python3 test_kokoro.py
```

## 📝 Notes

- The backend uses the official Kokoro implementation from kokoro-main-ref
- Voice files are loaded from the kokoro-main-ref/voices/ directory
- The model runs on CPU by default for compatibility
- For production use, consider adding proper error handling and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is based on Kokoro TTS, which is licensed under the Apache License 2.0.