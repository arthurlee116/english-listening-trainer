from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import soundfile as sf
import io
import logging
import os
import sys
from typing import Dict, List, Optional

# Add the kokoro-main-ref to path to import kokoro
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
grandparent_dir = os.path.dirname(parent_dir)
kokoro_path = os.path.join(grandparent_dir, 'kokoro-main-ref')
sys.path.append(kokoro_path)
# Import kokoro modules directly
from kokoro.model import KModel
from kokoro.pipeline import KPipeline
import torch

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
)

# Global variables for model and pipelines
pipelines = {}
model = None
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

def crossfade_audio(audio1: np.ndarray, audio2: np.ndarray, sample_rate: int, fade_duration: float = 0.1) -> np.ndarray:
    """
    在两个音频片段之间创建交叉淡化效果
    
    Args:
        audio1: 第一个音频片段
        audio2: 第二个音频片段
        sample_rate: 采样率
        fade_duration: 淡化持续时间（秒）
    
    Returns:
        拼接后的音频
    """
    fade_samples = int(fade_duration * sample_rate)
    
    if fade_samples == 0:
        return np.concatenate([audio1, audio2])
    
    # 确保淡化样本数不超过音频长度
    fade_samples = min(fade_samples, len(audio1), len(audio2))
    
    # 创建淡化曲线
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    
    # 应用淡化效果
    audio1_end = audio1[-fade_samples:] * fade_out
    audio2_start = audio2[:fade_samples] * fade_in
    
    # 拼接音频
    result = np.concatenate([
        audio1[:-fade_samples],  # 第一个音频的非淡化部分
        audio1_end + audio2_start,  # 淡化重叠部分
        audio2[fade_samples:]  # 第二个音频的非淡化部分
    ])
    
    return result

def concatenate_audio_chunks(audio_chunks: List[np.ndarray], sample_rate: int) -> np.ndarray:
    """
    智能拼接多个音频片段，使用交叉淡化减少停顿
    
    Args:
        audio_chunks: 音频片段列表
        sample_rate: 采样率
    
    Returns:
        拼接后的完整音频
    """
    if len(audio_chunks) == 0:
        raise ValueError("No audio chunks to concatenate")
    
    if len(audio_chunks) == 1:
        return audio_chunks[0]
    
    # 逐个拼接音频片段
    result = audio_chunks[0]
    for i in range(1, len(audio_chunks)):
        result = crossfade_audio(result, audio_chunks[i], sample_rate)
    
    return result

@app.on_event("startup")
async def startup_event():
    """Initialize Kokoro pipelines on startup"""
    global pipelines, model
    
    try:
        logger.info("Loading Kokoro TTS model...")
        
        # Initialize model (CPU mode for now)
        model = KModel()
        model = model.to('cpu').eval()
        
        logger.info("Loading Kokoro TTS pipelines...")
        
        # Initialize pipelines for supported languages
        for lang_code in ['a', 'b']:  # American and British English
            try:
                pipelines[lang_code] = KPipeline(lang_code=lang_code, model=model)
                logger.info(f"Loaded pipeline for language code: {lang_code}")
            except Exception as e:
                logger.error(f"Failed to load pipeline for {lang_code}: {e}")
        
        # Pre-load voices to improve performance
        for lang_code, pipeline in pipelines.items():
            lang_voices = [v for v in available_voices if v.startswith(lang_code)]
            for voice in lang_voices[:5]:  # Load first 5 voices per language
                try:
                    pipeline.load_voice(voice)
                    logger.info(f"Pre-loaded voice: {voice}")
                except Exception as e:
                    logger.warning(f"Failed to pre-load voice {voice}: {e}")
        
        logger.info("Kokoro TTS pipelines loaded successfully!")
        
    except Exception as e:
        logger.error(f"Failed to initialize Kokoro pipelines: {e}")
        raise

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Kokoro TTS Backend API is running"}

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

@app.post("/tts", response_model=TTSResponse)
async def generate_speech(request: TTSRequest):
    """Generate speech from text using Kokoro TTS"""
    try:
        if not pipelines:
            raise HTTPException(status_code=500, detail="Pipelines not initialized")
        
        if request.voice not in available_voices:
            raise HTTPException(status_code=400, detail=f"Voice {request.voice} not available")
        
        if request.lang_code not in pipelines:
            raise HTTPException(status_code=400, detail=f"Language code {request.lang_code} not supported")
        
        logger.info(f"Generating speech for: {request.text[:100]}...")
        logger.info(f"Using voice: {request.voice}, lang_code: {request.lang_code}, speed: {request.speed}")
        
        # Get the appropriate pipeline
        pipeline = pipelines[request.lang_code]
        
        # Load voice if not already loaded
        try:
            voice_pack = pipeline.load_voice(request.voice)
        except Exception as e:
            logger.error(f"Failed to load voice {request.voice}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load voice: {str(e)}")
        
        # Generate audio
        audio_chunks = []
        for i, (graphemes, phonemes, audio) in enumerate(pipeline(
            request.text, 
            voice=request.voice, 
            speed=request.speed,
            split_pattern=r'\n+'
        )):
            logger.info(f"Generated chunk {i+1}: {len(graphemes)} characters, {len(phonemes)} phonemes")
            audio_chunks.append(audio)
        
        if not audio_chunks:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Concatenate all audio chunks with crossfading
        if len(audio_chunks) > 1:
            final_audio = concatenate_audio_chunks(audio_chunks, request.sample_rate)
            logger.info(f"Concatenated {len(audio_chunks)} audio chunks with crossfading")
        else:
            final_audio = audio_chunks[0]
        
        # Create WAV file in memory
        buffer = io.BytesIO()
        sf.write(buffer, final_audio, request.sample_rate, format='WAV')
        buffer.seek(0)
        
        # Return audio file
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

@app.post("/tts/stream")
async def generate_speech_stream(request: TTSRequest):
    """Generate speech with streaming support"""
    try:
        if not pipelines:
            raise HTTPException(status_code=500, detail="Pipelines not initialized")
        
        if request.voice not in available_voices:
            raise HTTPException(status_code=400, detail=f"Voice {request.voice} not available")
        
        if request.lang_code not in pipelines:
            raise HTTPException(status_code=400, detail=f"Language code {request.lang_code} not supported")
        
        logger.info(f"Generating streaming speech for: {request.text[:100]}...")
        
        # Get the appropriate pipeline
        pipeline = pipelines[request.lang_code]
        
        # Load voice if not already loaded
        try:
            voice_pack = pipeline.load_voice(request.voice)
        except Exception as e:
            logger.error(f"Failed to load voice {request.voice}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load voice: {str(e)}")
        
        async def generate_audio_stream():
            for i, (graphemes, phonemes, audio) in enumerate(pipeline(
                request.text, 
                voice=request.voice, 
                speed=request.speed,
                split_pattern=r'\n+'
            )):
                logger.info(f"Streaming chunk {i+1}")
                
                # Create WAV file in memory for this chunk
                buffer = io.BytesIO()
                sf.write(buffer, audio, request.sample_rate, format='WAV')
                buffer.seek(0)
                
                yield buffer.getvalue()
        
        return StreamingResponse(
            generate_audio_stream(),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=speech.wav"}
        )
        
    except Exception as e:
        logger.error(f"Error generating streaming speech: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)