from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import numpy as np
import soundfile as sf
import io
import json
import logging
import os
import sys
import time
import threading
import asyncio
import uuid
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kokoro TTS Backend API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],  # Expose custom headers
)

# Available voices - based on kokoro-main-ref
available_voices = {
    'af_heart', 'af_bella', 'af_nicole', 'af_aoede', 'af_kore', 'af_sarah', 
    'af_nova', 'af_sky', 'af_alloy', 'af_jessica', 'af_river', 'am_michael', 
    'am_fenrir', 'am_puck', 'am_echo', 'am_eric', 'am_liam', 'am_onyx', 
    'am_santa', 'am_adam', 'bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily', 
    'bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel'
}

class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0
    lang_code: str = "a"  # 'a' for American English, 'b' for British English
    sample_rate: int = 24000

class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    error: Optional[str] = None

class VoicesResponse(BaseModel):
    voices: List[str]
    lang_codes: Dict[str, str]

class ProgressUpdate(BaseModel):
    progress: int
    stage: str
    message: str
    request_id: str

# Global variables for kokoro model
pipelines = {}
model = None

# Progress tracking
progress_data = {}
progress_lock = threading.Lock()

class ProgressTracker:
    def __init__(self, request_id: str):
        self.request_id = request_id
        self.progress = 0
        self.stage = "initializing"
        self.message = "Initializing..."
        self.start_time = time.time()
        
    def update_progress(self, progress: int, stage: str, message: str):
        with progress_lock:
            self.progress = progress
            self.stage = stage
            self.message = message
            progress_data[self.request_id] = {
                'progress': progress,
                'stage': stage,
                'message': message,
                'timestamp': time.time(),
                'elapsed_time': time.time() - self.start_time
            }
            logger.info(f"Progress update: {progress}% - {stage} - {message}")
    
    def get_progress(self):
        with progress_lock:
            return {
                'progress': self.progress,
                'stage': self.stage,
                'message': self.message
            }

class TrackedKPipeline:
    """Wrapper for KPipeline with progress tracking callbacks"""
    def __init__(self, original_pipeline, tracker: ProgressTracker):
        self.original_pipeline = original_pipeline
        self.tracker = tracker
        
    def __call__(self, text, voice=None, speed=1.0, split_pattern=None):
        """Override the __call__ method to add progress tracking"""
        
        # Track text processing phase
        self.tracker.update_progress(25, "text_processing", "Analyzing text structure and generating phonemes...")
        
        # Use the original pipeline to process text but track progress
        total_chunks_estimate = len(text.split('\n')) if '\n' in text else 1
        self.tracker.update_progress(30, "chunk_analysis", f"Preparing to process approximately {total_chunks_estimate} text segments...")
        
        # Use the original pipeline's generator but wrap it with progress tracking
        chunk_count = 0
        for i, (graphemes, phonemes, audio) in enumerate(self.original_pipeline(
            text, 
            voice=voice, 
            speed=speed,
            split_pattern=split_pattern
        )):
            chunk_count += 1
            
            # Calculate detailed progress based on chunk processing
            base_progress = 35
            progress_per_chunk = 45  # 45% progress range for all chunks
            current_progress = base_progress + int((chunk_count / max(total_chunks_estimate, 1)) * progress_per_chunk)
            
            # More granular progress stages
            if chunk_count == 1:
                self.tracker.update_progress(
                    current_progress, 
                    "first_chunk_processing", 
                    f"Processing first segment ({len(graphemes)} chars): '{graphemes[:30]}{'...' if len(graphemes) > 30 else ''}'"
                )
            elif chunk_count == total_chunks_estimate:
                self.tracker.update_progress(
                    current_progress, 
                    "final_chunk_processing", 
                    f"Processing final segment {chunk_count}/{total_chunks_estimate} ({len(graphemes)} chars)"
                )
            else:
                self.tracker.update_progress(
                    current_progress, 
                    "chunk_processing", 
                    f"Processing segment {chunk_count}/{total_chunks_estimate} ({len(graphemes)} chars, {len(phonemes)} phonemes)"
                )
            
            # Simulate model inference progress within each chunk
            self.tracker.update_progress(
                current_progress + 5, 
                "neural_network_processing", 
                f"Running BERT encoding and prosody prediction..."
            )
            
            self.tracker.update_progress(
                current_progress + 10, 
                "audio_synthesis", 
                f"Synthesizing audio waveform through neural decoder..."
            )
            
            yield (graphemes, phonemes, audio)
        
        # Final progress update
        self.tracker.update_progress(90, "final_processing", "Finalizing audio generation...")
    
    def load_voice(self, voice):
        """Delegate voice loading to original pipeline"""
        return self.original_pipeline.load_voice(voice)

def initialize_kokoro():
    """Initialize Kokoro model and pipelines"""
    global pipelines, model
    
    try:
        # Add kokoro-main-ref to path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(script_dir)
        grandparent_dir = os.path.dirname(parent_dir)
        kokoro_path = os.path.join(grandparent_dir, 'kokoro-main-ref')
        sys.path.append(kokoro_path)
        
        # Import kokoro modules
        from kokoro.model import KModel
        from kokoro.pipeline import KPipeline
        
        logger.info("Loading Kokoro TTS model...")
        
        # Initialize model (CPU mode for now)
        model = KModel()
        model = model.to('cpu').eval()
        
        # Initialize pipelines for supported languages
        for lang_code in ['a', 'b']:  # American and British English
            try:
                pipelines[lang_code] = KPipeline(lang_code=lang_code, model=model)
                logger.info(f"Loaded pipeline for language code: {lang_code}")
            except Exception as e:
                logger.error(f"Failed to load pipeline for {lang_code}: {e}")
        
        logger.info("Kokoro TTS model loaded successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Kokoro: {e}")
        return False

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    success = initialize_kokoro()
    if not success:
        logger.warning("Kokoro model initialization failed, will use fallback mode")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Kokoro TTS Backend API is running", "model_loaded": model is not None}

@app.get("/voices", response_model=VoicesResponse)
async def get_voices():
    """Get available voices and language codes"""
    return {
        "voices": list(available_voices),
        "lang_codes": {
            "a": "American English",
            "b": "British English"
        }
    }

@app.get("/progress/{request_id}")
async def progress_stream(request_id: str):
    """Server-Sent Events endpoint for progress updates"""
    
    async def generate():
        last_progress = -1
        while True:
            with progress_lock:
                if request_id in progress_data:
                    current_progress = progress_data[request_id]
                    if current_progress['progress'] != last_progress:
                        last_progress = current_progress['progress']
                        yield f"data: {json.dumps(current_progress)}\n\n"
                    
                    # Clean up old progress data (older than 5 minutes)
                    current_time = time.time()
                    progress_data_copy = progress_data.copy()
                    for rid, data in progress_data_copy.items():
                        if current_time - data['timestamp'] > 300:  # 5 minutes
                            del progress_data[rid]
                else:
                    # No progress data found for this request
                    yield f"data: {json.dumps({'progress': 0, 'stage': 'waiting', 'message': 'Waiting for progress data...'})}\n\n"
                
            await asyncio.sleep(0.1)  # Check every 100ms
            
            # Stop streaming if progress is 100% or request is no longer active
            if last_progress == 100:
                yield f"data: {json.dumps({'progress': 100, 'stage': 'completed', 'message': 'Progress tracking completed'})}\n\n"
                break
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@app.post("/tts", response_model=TTSResponse)
async def generate_speech(request: TTSRequest):
    """Generate speech from text using Kokoro TTS"""
    # Generate unique request ID for progress tracking
    request_id = str(uuid.uuid4())
    tracker = ProgressTracker(request_id)
    
    try:
        tracker.update_progress(0, "initializing", "Initializing TTS system...")
        
        if not model or not pipelines:
            raise HTTPException(status_code=500, detail="Kokoro model not initialized")
        
        if request.voice not in available_voices:
            raise HTTPException(status_code=400, detail=f"Voice {request.voice} not available")
        
        if request.lang_code not in pipelines:
            raise HTTPException(status_code=400, detail=f"Language code {request.lang_code} not supported")
        
        logger.info(f"Generating speech for: {request.text[:100]}...")
        logger.info(f"Using voice: {request.voice}, lang_code: {request.lang_code}, speed: {request.speed}")
        
        # Get the appropriate pipeline
        tracker.update_progress(10, "loading_pipeline", "Loading voice pipeline...")
        original_pipeline = pipelines[request.lang_code]
        
        # Load voice
        try:
            tracker.update_progress(15, "loading_voice", f"Loading voice: {request.voice}...")
            voice_pack = original_pipeline.load_voice(request.voice)
            logger.info(f"Voice {request.voice} loaded successfully: {type(voice_pack)}")
        except Exception as e:
            logger.error(f"Failed to load voice {request.voice}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load voice: {str(e)}")
        
        # Create tracked pipeline wrapper
        tracker.update_progress(20, "preparing_pipeline", "Preparing audio generation pipeline...")
        tracked_pipeline = TrackedKPipeline(original_pipeline, tracker)
        
        # Generate audio with detailed progress tracking
        audio_chunks = []
        
        try:
            tracker.update_progress(25, "starting_generation", "Starting detailed audio generation process...")
            
            # Use the tracked pipeline for generation
            for i, (graphemes, phonemes, audio) in enumerate(tracked_pipeline(
                request.text, 
                voice=request.voice, 
                speed=request.speed,
                split_pattern=r'\n+'
            )):
                logger.info(f"Generated chunk {i+1}: {len(graphemes)} characters, {len(phonemes)} phonemes, audio type: {type(audio)}")
                if audio is None:
                    logger.error(f"Audio is None for chunk {i+1}")
                else:
                    logger.info(f"Audio shape: {audio.shape if hasattr(audio, 'shape') else 'no shape'}")
                audio_chunks.append(audio)
                
        except Exception as e:
            logger.error(f"Error during audio generation: {e}")
            logger.error(f"Error type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error during audio generation: {str(e)}")
        
        if not audio_chunks:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Concatenate all audio chunks
        tracker.update_progress(85, "processing_audio", "Processing and combining audio segments...")
        
        if len(audio_chunks) > 1:
            # Filter out None chunks
            valid_chunks = [chunk for chunk in audio_chunks if chunk is not None]
            if valid_chunks:
                final_audio = np.concatenate(valid_chunks)
            else:
                raise HTTPException(status_code=500, detail="No valid audio chunks generated")
        elif audio_chunks[0] is not None:
            final_audio = audio_chunks[0]
        else:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Create WAV file in memory
        tracker.update_progress(95, "creating_file", "Creating audio file...")
        buffer = io.BytesIO()
        sf.write(buffer, final_audio, request.sample_rate, format='WAV')
        buffer.seek(0)
        
        tracker.update_progress(100, "completed", "Audio generation completed!")
        
        # Return audio file with request ID in headers
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav",
                "X-Request-ID": request_id
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        tracker.update_progress(0, "error", f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)