#!/usr/bin/env python3
"""
Kokoro TTS Wrapper for Apple Silicon M4/Metal Acceleration
本地TTS服务包装器，支持Metal加速和模型预加载
"""

import asyncio
import json
import sys
import os
import logging
from typing import Optional
import torch
import soundfile as sf
import io
from text_chunker import split_text_intelligently, MAX_CHUNK_CHAR_SIZE

# 设置日志
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# 设置事件循环策略以避免macOS上的问题
if sys.platform == "darwin":
    import asyncio
    if sys.version_info >= (3, 8):
        asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())

class KokoroTTSWrapper:
    """Kokoro TTS服务包装器，支持动态语言配置"""
    
    def __init__(self, lang_code: str = 'a', voice: str = 'af_heart'):
        self.pipeline = None
        self.device = None
        self.voice_pack = None
        self.initialized = False
        self.lang_code = lang_code
        self.voice = voice
        self.current_lang_code = None
        self.current_voice = None
        
    def setup_device(self):
        """设置计算设备 (自动检测CUDA/Metal/CPU)"""
        try:
            # 获取环境变量指定的设备
            device_override = os.environ.get('KOKORO_DEVICE', 'auto').lower()
            
            if device_override == 'cuda' and torch.cuda.is_available():
                self.device = 'cuda'
                print(f"🚀 Using CUDA acceleration (GPU: {torch.cuda.get_device_name(0)})", file=sys.stderr)
                return
            elif device_override == 'metal' and torch.backends.mps.is_available():
                self.device = 'mps'
                os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
                print("🚀 Using Metal Performance Shaders (MPS) for Apple Silicon", file=sys.stderr)
                return
            elif device_override == 'cpu':
                self.device = 'cpu'
                print("📱 Using CPU for TTS processing (forced)", file=sys.stderr)
                return
            
            # 自动检测最佳设备
            if torch.cuda.is_available():
                # NVIDIA CUDA 支持
                self.device = 'cuda'
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                print(f"🚀 Using CUDA acceleration (GPU: {gpu_name}, Memory: {gpu_memory:.1f}GB)", file=sys.stderr)
                # 设置CUDA优化
                torch.backends.cudnn.benchmark = True
            elif torch.backends.mps.is_available():
                # Apple Silicon Metal 支持
                self.device = 'mps'
                os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
                print("🚀 Using Metal Performance Shaders (MPS) for Apple Silicon", file=sys.stderr)
            else:
                # CPU 后备
                self.device = 'cpu'
                print("📱 Using CPU for TTS processing", file=sys.stderr)
        except Exception as e:
            print(f"ERROR in setup_device: {e}", file=sys.stderr)
            self.device = 'cpu'  # 回退到CPU
            
    async def initialize(self, lang_code: Optional[str] = None, voice: Optional[str] = None):
        """初始化或重新初始化Kokoro模型和语音"""
        # 更新语言和语音配置
        if lang_code is not None:
            self.lang_code = lang_code
        if voice is not None:
            self.voice = voice
            
        # 检查是否需要重新初始化
        need_reinit = (
            not self.initialized or 
            self.current_lang_code != self.lang_code or
            self.current_voice != self.voice
        )
        
        if not need_reinit:
            return
            
        try:
            self.setup_device()
            
            if not self.device:
                raise Exception("Failed to setup device")
            
            # 导入Kokoro (延迟导入以处理可能的依赖问题)
            from kokoro.pipeline import KPipeline
            
            # 禁用kokoro内部日志
            import kokoro
            kokoro.logger.disable("kokoro")
            
            # 初始化pipeline (如果语言改变需要重新创建)
            if self.current_lang_code != self.lang_code:
                print(f"🌍 Initializing pipeline for language: {self.lang_code}", file=sys.stderr)

                # 强制离线模式，不允许在线下载
                os.environ['HF_HUB_OFFLINE'] = '1'
                os.environ['TRANSFORMERS_OFFLINE'] = '1'

                # 扫描本地模型路径（按优先级）
                from pathlib import Path
                import shutil

                local_model_paths = []
                # 优先：环境变量指定的路径（仅在设置且非空时添加）
                env_model_path = os.environ.get('KOKORO_LOCAL_MODEL_PATH')
                if env_model_path:
                    local_model_paths.append(Path(env_model_path))

                # 次选和备选路径
                local_model_paths.extend([
                    # 次选：项目本地缓存
                    Path('kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main'),
                    # 备选：用户 home 目录缓存
                    Path.home() / '.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main',
                    # 备选：独立模型目录
                    Path('kokoro-models/Kokoro-82M'),
                ])

                found_model = None
                for model_path in local_model_paths:
                    if model_path.exists() and model_path.is_dir():
                        found_model = model_path
                        print(f"✅ Found local model at: {model_path}", file=sys.stderr)
                        break

                if not found_model:
                    # 模型未找到，抛出明确错误
                    error_msg = (
                        "❌ Kokoro model not found in offline mode.\n"
                        "Searched paths:\n" +
                        "\n".join([f"  - {p}" for p in local_model_paths if str(p)]) +
                        "\n\nPlease ensure model exists at one of the above paths,\n"
                        "or set KOKORO_LOCAL_MODEL_PATH environment variable."
                    )
                    raise FileNotFoundError(error_msg)

                # 确保模型在标准缓存位置（Kokoro 期望的结构）
                cache_path = Path.home() / '.cache/huggingface/hub/models--hexgrad--Kokoro-82M'
                snapshot_dir = cache_path / 'snapshots/main'

                if not snapshot_dir.exists() and found_model != snapshot_dir:
                    print(f"📦 Copying model to HuggingFace cache structure...", file=sys.stderr)
                    cache_path.mkdir(parents=True, exist_ok=True)
                    (cache_path / 'refs').mkdir(exist_ok=True)
                    shutil.copytree(found_model, snapshot_dir, dirs_exist_ok=True)
                    (cache_path / 'refs/main').write_text('main')
                    print("✅ Model copied to cache", file=sys.stderr)

                # 初始化 pipeline（仅离线模式）
                try:
                    self.pipeline = KPipeline(lang_code=self.lang_code)
                    print(f"✅ Kokoro TTS initialized in offline mode for language: {self.lang_code}", file=sys.stderr)
                except Exception as e:
                    print(f"❌ Pipeline initialization failed: {e}", file=sys.stderr)
                    raise RuntimeError(f"Failed to initialize Kokoro pipeline: {e}")

                self.current_lang_code = self.lang_code
            
            # 加载语音 (如果语音改变需要重新加载)
            if self.current_voice != self.voice:
                try:
                    print(f"🎵 Loading voice: {self.voice}", file=sys.stderr)
                    self.voice_pack = self.pipeline.load_voice(self.voice)
                    self.current_voice = self.voice
                except Exception as e:
                    print(f"⚠️  Warning: Failed to load voice {self.voice}: {e}", file=sys.stderr)
                    # 尝试加载默认语音
                    try:
                        fallback_voice = 'af_heart' if self.lang_code == 'a' else f"{self.lang_code}f_alpha"
                        print(f"🔄 Trying fallback voice: {fallback_voice}", file=sys.stderr)
                        self.voice_pack = self.pipeline.load_voice(fallback_voice)
                        self.voice = fallback_voice
                        self.current_voice = fallback_voice
                    except Exception as e2:
                        print(f"❌ Fallback voice also failed: {e2}", file=sys.stderr)
                        self.voice_pack = None
            
            self.initialized = True
            
            # 发送就绪信号到stderr
            print(f'🚀 Kokoro TTS service ready - Language: {self.lang_code}, Voice: {self.voice}', file=sys.stderr)
            sys.stderr.flush()
            
        except Exception as e:
            print(f"❌ Initialization failed: {e}", file=sys.stderr)
            raise
            
    async def generate_speech(self, text: str, speed: float = 1.0, parallel: bool = True) -> str:
        """生成音频，返回十六进制字符串"""
        if not self.initialized:
            await self.initialize()
            
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # 处理长文本：分块而不是截取
        print(f"🔍 Text length check: {len(text)} chars", file=sys.stderr)
        if len(text) > MAX_CHUNK_CHAR_SIZE:
            print(f"📝 Text is long ({len(text)} chars), will chunk into {MAX_CHUNK_CHAR_SIZE}-char pieces", file=sys.stderr)
            return await self.generate_speech_chunked(text, speed)
            
        # 对于短文本，直接使用单块处理
        return await self.generate_speech_single(text, speed)

    async def generate_speech_chunked(self, text: str, speed: float = 1.0) -> str:
        """分块生成音频并拼接（线程池并行 + 可配置并发度）"""
        chunks = split_text_intelligently(text)
        total = len(chunks)
        print(f"🧩 Split text into {total} chunks for parallel processing", file=sys.stderr)

        # 在本函数内定义同步的块生成函数，在线程池中执行
        def _generate_chunk_hex_sync(chunk_text: str, s: float) -> str:
            import torch
            buffer = io.BytesIO()
            audio_tensors = []
            # 直接对该块运行一次pipeline（避免重复遍历）
            for _, _, audio in self.pipeline(
                chunk_text,
                voice=self.voice,
                speed=s,
                split_pattern=r'\n+'
            ):
                if audio is not None:
                    if self.device == 'mps':
                        audio = audio.to('cpu')
                    audio_tensors.append(audio)

            if not audio_tensors:
                raise Exception("No audio chunks were generated")

            combined = torch.cat(audio_tensors)
            sf.write(buffer, combined.numpy(), 24000, format='WAV')
            return buffer.getvalue().hex()

        # 并发度（默认2，可通过环境变量调整）
        try:
            max_concurrency = max(1, int(os.environ.get('KOKORO_TTS_MAX_CONCURRENCY', '2')))
        except Exception:
            max_concurrency = 2

        sem = asyncio.Semaphore(max_concurrency)

        async def worker(idx: int, chunk_text: str):
            print(f"🚀 Starting chunk {idx+1}/{total}: {len(chunk_text)} chars", file=sys.stderr)
            async with sem:
                # 在线程池中执行CPU密集型任务
                hex_data = await asyncio.to_thread(_generate_chunk_hex_sync, chunk_text, speed)
                return idx, hex_data

        tasks = [worker(i, c) for i, c in enumerate(chunks)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果并按原始顺序拼接
        audio_chunks: list[bytes] = []
        for result in sorted(
            [r for r in results if not isinstance(r, Exception)], key=lambda x: x[0]
        ):
            idx, chunk_hex = result
            try:
                chunk_bytes = bytes.fromhex(chunk_hex)
                if chunk_bytes.startswith(b'RIFF'):
                    data_pos = chunk_bytes.find(b'data')
                    if data_pos == -1:
                        print(f"❌ No 'data' chunk found in audio for chunk {idx+1}", file=sys.stderr)
                        continue
                    data_start = data_pos + 8
                    if data_start >= len(chunk_bytes):
                        print(f"❌ Invalid data chunk position for chunk {idx+1}", file=sys.stderr)
                        continue
                    audio_data = chunk_bytes[data_start:]
                    audio_chunks.append(audio_data)
                else:
                    audio_chunks.append(chunk_bytes)
                print(f"✅ Chunk {idx+1} processed successfully.", file=sys.stderr)
            except Exception as e:
                print(f"❌ Error processing result for chunk {idx+1}: {e}", file=sys.stderr)
                continue

        
        if not audio_chunks:
            raise Exception("No audio chunks were generated successfully")
        
        # 拼接所有音频数据
        combined_audio_data = b''.join(audio_chunks)
        
        # 确保音频数据对齐到样本边界 (16位=2字节对齐)
        if len(combined_audio_data) % 2 != 0:
            combined_audio_data += b'\x00'  # 填充一个字节
        
        # 创建新的WAV头
        import struct
        sample_rate = 24000
        num_channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_size = len(combined_audio_data)
        file_size = 36 + data_size
        
        # 确保WAV头完全正确 (RIFF文件大小应该是整个文件减去8字节)
        riff_size = 36 + data_size  # fmt chunk (24 bytes) + data chunk header (8 bytes) + data
        wav_header = struct.pack('<4sI4s4sIHHIIHH4sI',
            b'RIFF',           # ChunkID
            riff_size,         # ChunkSize (整个文件大小 - 8)
            b'WAVE',           # Format
            b'fmt ',           # Subchunk1ID
            16,                # Subchunk1Size (PCM = 16)
            1,                 # AudioFormat (PCM = 1)
            num_channels,      # NumChannels
            sample_rate,       # SampleRate
            byte_rate,         # ByteRate
            block_align,       # BlockAlign
            bits_per_sample,   # BitsPerSample
            b'data',           # Subchunk2ID
            data_size          # Subchunk2Size
        )
        
        print(f"🔧 WAV Header Info:", file=sys.stderr)
        print(f"  - Sample Rate: {sample_rate} Hz", file=sys.stderr)
        print(f"  - Channels: {num_channels}", file=sys.stderr)
        print(f"  - Bit Depth: {bits_per_sample} bits", file=sys.stderr)
        print(f"  - Data Size: {data_size} bytes", file=sys.stderr)
        print(f"  - File Size: {file_size + 8} bytes", file=sys.stderr)
        
        # 组合完整的WAV文件
        complete_wav = wav_header + combined_audio_data
        
        total_duration = len(combined_audio_data) / (sample_rate * num_channels * bits_per_sample // 8)
        print(f"🎵 Combined {len(chunks)} chunks, total length: {total_duration:.2f}s", file=sys.stderr)
        
        return complete_wav.hex()
    
    async def generate_speech_single(self, text: str, speed: float = 1.0) -> str:
        """生成单个文本块的音频（原来的generate_speech逻辑）"""
        try:
            import torch
            import concurrent.futures
            
            # 首先收集所有文本块
            text_chunks = []
            for i, (graphemes, phonemes, audio) in enumerate(
                self.pipeline(
                    text, 
                    voice=self.voice, 
                    speed=speed,
                    split_pattern=r'\n+'
                )
            ):
                if audio is not None:
                    text_chunks.append((i, graphemes, phonemes))
                    print(f"🎵 Found chunk {i+1}: {len(graphemes)} chars, {len(phonemes)} phonemes", file=sys.stderr)
            
            if not text_chunks:
                raise Exception("No audio chunks were generated")
            
            print(f"🎵 Total {len(text_chunks)} chunks to process", file=sys.stderr)
            
            # 串行处理（单块音频不需要并行）
            print(f"📝 Processing {len(text_chunks)} chunks sequentially...", file=sys.stderr)
            
            audio_chunks = []
            for i, (graphemes, phonemes, audio) in enumerate(
                self.pipeline(
                    text, 
                    voice=self.voice, 
                    speed=speed,
                    split_pattern=r'\n+'
                )
            ):
                if audio is not None:
                    if self.device == 'mps':
                        audio = audio.to('cpu')
                    audio_chunks.append(audio)
                    print(f"✅ Chunk {i+1} completed", file=sys.stderr)
            
            if not audio_chunks:
                raise Exception("No audio chunks were generated successfully")
            
            # 拼接所有音频块
            combined_audio = torch.cat(audio_chunks)
            
            # 转换为字节数据
            import io
            import soundfile as sf
            buffer = io.BytesIO()
            sf.write(buffer, combined_audio.numpy(), 24000, format='WAV')
            audio_data = buffer.getvalue()
            
            total_duration = len(combined_audio) / 24000
            print(f"🎵 Generated {len(audio_chunks)} chunks, total length: {total_duration:.2f}s", file=sys.stderr)
            
            return audio_data.hex()
            
        except Exception as e:
            print(f"❌ Error in generate_speech_single: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            raise

async def main():
    """主函数：监听stdin输入并处理请求"""
    service = KokoroTTSWrapper()
    
    try:
        # 初始化模型
        await service.initialize()
        
        # 发送就绪信号到stderr
        print('🚀 Kokoro TTS service is ready', file=sys.stderr)
        sys.stderr.flush()
        
        # 监听标准输入
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                    
                line = line.strip()
                if not line:
                    continue
                    
                # 解析JSON请求
                request = json.loads(line)
                
                # 获取语言和语音配置
                lang_code = request.get('lang_code', 'a')
                voice = request.get('voice', 'af_heart')
                
                # 重新初始化服务（如果需要）
                await service.initialize(lang_code=lang_code, voice=voice)
                
                # 处理请求
                result = await service.generate_speech(
                    text=request.get('text', ''),
                    speed=float(request.get('speed', 1.0))
                )
                
                # 返回结果
                response = {
                    "success": True,
                    "audio_data": result,
                    "device": service.device or "unknown",
                    "lang_code": service.lang_code,
                    "voice": service.voice,
                    "message": "Audio generated successfully"
                }
                
                # 发送JSON响应
                json_response = json.dumps(response)
                print(json_response, flush=True)
                
            except json.JSONDecodeError:
                error_response = {
                    "success": False,
                    "error": "Invalid JSON format"
                }
                print(json.dumps(error_response))
                sys.stdout.flush()
                
            except Exception as e:
                error_response = {
                    "success": False,
                    "error": str(e)
                }
                print(json.dumps(error_response))
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        pass
    except Exception as e:
        sys.exit(1)

# 简单测试函数
async def test():
    """测试函数"""
    service = KokoroTTSWrapper()
    await service.initialize()
    result = await service.generate_speech("Hello test", 1.0)
    print(json.dumps({
        "success": True,
        "audio_data": result,
        "device": service.device or "unknown",
        "message": "Test completed"
    }))

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        asyncio.run(test())
    else:
        asyncio.run(main())
