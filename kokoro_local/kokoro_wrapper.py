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
from threading import Lock
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
        self._pipeline_lock = Lock()
        
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
        """分块生成音频并拼接（串行保障 pipeline 安全，使用 soundfile 输出规范 WAV）"""
        chunks = split_text_intelligently(text)
        total = len(chunks)
        print(f"🧩 Split text into {total} chunks for processing", file=sys.stderr)

        lock = self._pipeline_lock

        def _synthesize_chunk(chunk_text: str, s: float):
            import numpy as np
            audio_tensors = []
            with lock:
                for _, _, audio in self.pipeline(
                    chunk_text,
                    voice=self.voice,
                    speed=s,
                    split_pattern=r'\n+'
                ):
                    if audio is not None:
                        if self.device == 'mps':
                            audio = audio.to('cpu')
                        audio_tensors.append(audio.detach().cpu())

            if not audio_tensors:
                raise RuntimeError("No audio chunks were generated")

            combined_tensor = torch.cat(audio_tensors)
            return combined_tensor.numpy().astype(np.float32)

        pcm_segments = []
        for idx, chunk in enumerate(chunks):
            print(f"🚀 Synthesizing chunk {idx + 1}/{total}: {len(chunk)} chars", file=sys.stderr)
            segment = await asyncio.to_thread(_synthesize_chunk, chunk, speed)
            pcm_segments.append(segment)

        if not pcm_segments:
            raise RuntimeError("No PCM segments collected from chunk synthesis")

        import numpy as np
        concatenated = np.concatenate(pcm_segments)
        buffer = io.BytesIO()
        sf.write(buffer, concatenated, 24000, format='WAV', subtype='PCM_16')
        total_duration = concatenated.shape[0] / 24000
        print(f"🎵 Combined {len(pcm_segments)} chunks, total length: {total_duration:.2f}s", file=sys.stderr)
        return buffer.getvalue().hex()
    
    async def generate_speech_single(self, text: str, speed: float = 1.0) -> str:
        """生成单个文本块的音频（串行生成，确保 pipeline 安全）"""
        try:
            def _synthesize_single():
                import numpy as np
                audio_segments = []
                with self._pipeline_lock:
                    for _, _, audio in self.pipeline(
                        text,
                        voice=self.voice,
                        speed=speed,
                        split_pattern=r'\n+'
                    ):
                        if audio is not None:
                            if self.device == 'mps':
                                audio = audio.to('cpu')
                            audio_segments.append(audio.detach().cpu())

                if not audio_segments:
                    raise RuntimeError("No audio chunks were generated")

                combined = torch.cat(audio_segments)
                return combined.numpy().astype(np.float32)

            pcm = await asyncio.to_thread(_synthesize_single)
            buffer = io.BytesIO()
            sf.write(buffer, pcm, 24000, format='WAV', subtype='PCM_16')
            total_duration = pcm.shape[0] / 24000
            print(f"🎵 Generated single segment, total length: {total_duration:.2f}s", file=sys.stderr)
            return buffer.getvalue().hex()

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
