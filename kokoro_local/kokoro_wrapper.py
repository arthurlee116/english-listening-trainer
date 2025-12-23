#!/usr/bin/env python3
"""
Kokoro TTS Wrapper - MPS 专用版本 (Apple Silicon M4 优化)
移除 CUDA/CPU 回退，最大化 MPS 性能
"""

import asyncio
import json
import sys
import os
import struct
import io
from typing import Optional

import torch
import soundfile as sf

from text_chunker import split_text_intelligently, MAX_CHUNK_CHAR_SIZE

# 强制 MPS 设备
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'

class KokoroTTSWrapper:
    """Kokoro TTS 服务 - MPS 专用"""
    
    def __init__(self, lang_code: str = 'a', voice: str = 'af_heart'):
        self.pipeline = None
        self.device = 'mps'
        self.voice_pack = None
        self.initialized = False
        self.lang_code = lang_code
        self.voice = voice
        self.current_lang_code = None
        self.current_voice = None
        
    def _verify_mps(self):
        """验证 MPS 可用性"""
        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS not available. This wrapper requires Apple Silicon.")
        if not torch.backends.mps.is_built():
            raise RuntimeError("PyTorch not built with MPS support.")
        print("✅ MPS verified: Apple Silicon ready", file=sys.stderr)
        
    async def initialize(self, lang_code: Optional[str] = None, voice: Optional[str] = None):
        """初始化 Kokoro 模型"""
        if lang_code is not None:
            self.lang_code = lang_code
        if voice is not None:
            self.voice = voice
            
        need_reinit = (
            not self.initialized or 
            self.current_lang_code != self.lang_code or
            self.current_voice != self.voice
        )
        
        if not need_reinit:
            return
            
        self._verify_mps()
        print(f"🚀 Using MPS (Metal Performance Shaders) on Apple Silicon", file=sys.stderr)
        
        from kokoro.pipeline import KPipeline
        import kokoro
        kokoro.logger.disable("kokoro")
        
        # 离线模式
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        
        if self.current_lang_code != self.lang_code:
            print(f"🌍 Initializing pipeline: {self.lang_code}", file=sys.stderr)
            
            # 查找本地模型
            from pathlib import Path
            import shutil
            
            model_paths = [
                Path(os.environ.get('KOKORO_LOCAL_MODEL_PATH', '')),
                Path('kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main'),
                Path.home() / '.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main',
                Path('kokoro-models/Kokoro-82M'),
            ]
            
            found_model = next((p for p in model_paths if p.exists() and p.is_dir()), None)
            
            if not found_model:
                raise FileNotFoundError("Kokoro model not found. Run setup-kokoro.sh first.")
            
            print(f"✅ Model: {found_model}", file=sys.stderr)
            
            # 确保缓存结构
            cache_path = Path.home() / '.cache/huggingface/hub/models--hexgrad--Kokoro-82M'
            snapshot_dir = cache_path / 'snapshots/main'
            
            if not snapshot_dir.exists() and found_model != snapshot_dir:
                cache_path.mkdir(parents=True, exist_ok=True)
                (cache_path / 'refs').mkdir(exist_ok=True)
                shutil.copytree(found_model, snapshot_dir, dirs_exist_ok=True)
                (cache_path / 'refs/main').write_text('main')
            
            self.pipeline = KPipeline(lang_code=self.lang_code)
            self.current_lang_code = self.lang_code
        
        if self.current_voice != self.voice:
            print(f"🎵 Loading voice: {self.voice}", file=sys.stderr)
            try:
                self.voice_pack = self.pipeline.load_voice(self.voice)
                self.current_voice = self.voice
            except Exception as e:
                print(f"⚠️ Voice {self.voice} failed: {e}", file=sys.stderr)
                fallback = 'af_heart' if self.lang_code == 'a' else f"{self.lang_code}f_alpha"
                self.voice_pack = self.pipeline.load_voice(fallback)
                self.voice = fallback
                self.current_voice = fallback
        
        self.initialized = True
        print(f'🚀 Kokoro TTS ready - MPS | {self.lang_code} | {self.voice}', file=sys.stderr)
            
    async def generate_speech(self, text: str, speed: float = 1.0) -> str:
        """生成音频，返回十六进制字符串"""
        if not self.initialized:
            await self.initialize()
            
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        if len(text) > MAX_CHUNK_CHAR_SIZE:
            return await self._generate_chunked(text, speed)
        return await self._generate_single(text, speed)

    async def _generate_chunked(self, text: str, speed: float) -> str:
        """分块生成并拼接"""
        chunks = split_text_intelligently(text)
        print(f"🧩 Processing {len(chunks)} chunks", file=sys.stderr)
        
        audio_data_list = []
        
        for i, chunk in enumerate(chunks):
            print(f"🔄 Chunk {i+1}/{len(chunks)}", file=sys.stderr)
            chunk_hex = await self._generate_single(chunk, speed)
            chunk_bytes = bytes.fromhex(chunk_hex)
            
            # 提取 PCM 数据
            if chunk_bytes.startswith(b'RIFF'):
                data_pos = chunk_bytes.find(b'data')
                if data_pos != -1:
                    audio_data_list.append(chunk_bytes[data_pos + 8:])
            else:
                audio_data_list.append(chunk_bytes)
        
        # 拼接并创建 WAV
        combined = b''.join(audio_data_list)
        if len(combined) % 2 != 0:
            combined += b'\x00'
        
        wav_header = struct.pack('<4sI4s4sIHHIIHH4sI',
            b'RIFF', 36 + len(combined), b'WAVE', b'fmt ', 16,
            1, 1, 24000, 48000, 2, 16, b'data', len(combined))
        
        return (wav_header + combined).hex()
    
    async def _generate_single(self, text: str, speed: float) -> str:
        """单块生成"""
        audio_chunks = []
        
        for _, _, audio in self.pipeline(text, voice=self.voice, speed=speed, split_pattern=r'\n+'):
            if audio is not None:
                # MPS tensor 移到 CPU 进行文件写入
                audio_chunks.append(audio.cpu())
        
        if not audio_chunks:
            raise Exception("No audio generated")
        
        combined = torch.cat(audio_chunks)
        
        # 同步 MPS 确保完成
        torch.mps.synchronize()
        
        buffer = io.BytesIO()
        sf.write(buffer, combined.numpy(), 24000, format='WAV')
        
        return buffer.getvalue().hex()


async def main():
    """主循环：监听 stdin 请求"""
    service = KokoroTTSWrapper()
    await service.initialize()
    
    print('🚀 Kokoro TTS service is ready', file=sys.stderr)
    sys.stderr.flush()
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            line = line.strip()
            if not line:
                continue
            
            request = json.loads(line)
            request_id = request.get('request_id')
            
            await service.initialize(
                lang_code=request.get('lang_code'),
                voice=request.get('voice')
            )
            
            result = await service.generate_speech(
                text=request.get('text', ''),
                speed=float(request.get('speed', 1.0))
            )
            
            print(json.dumps({
                "success": True,
                "request_id": request_id,
                "audio_data": result,
                "device": "mps",
                "lang_code": service.lang_code,
                "voice": service.voice
            }), flush=True)
            
        except json.JSONDecodeError:
            print(json.dumps({"success": False, "error": "Invalid JSON"}), flush=True)
        except Exception as e:
            print(json.dumps({
                "success": False,
                "request_id": request.get('request_id') if 'request' in dir() else None,
                "error": str(e)
            }), flush=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        async def test():
            s = KokoroTTSWrapper()
            await s.initialize()
            r = await s.generate_speech("Hello MPS test", 1.0)
            print(json.dumps({"success": True, "audio_data": r, "device": "mps"}))
        asyncio.run(test())
    else:
        asyncio.run(main())
