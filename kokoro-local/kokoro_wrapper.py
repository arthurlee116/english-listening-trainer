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
        """设置计算设备 (优先使用MPS for M4)"""
        try:
            if torch.backends.mps.is_available():
                self.device = 'mps'
                # 启用MPS回退
                os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
                print("🚀 Using Metal Performance Shaders (MPS) for Apple Silicon", file=sys.stderr)
            else:
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
            sys.path.append('/Users/arthur/Code/0712/kokoro-main-ref')
            from kokoro.pipeline import KPipeline
            
            # 禁用kokoro内部日志
            import kokoro
            kokoro.logger.disable("kokoro")
            
            # 初始化pipeline (如果语言改变需要重新创建)
            if self.current_lang_code != self.lang_code:
                print(f"🌍 Initializing pipeline for language: {self.lang_code}", file=sys.stderr)
                self.pipeline = KPipeline(lang_code=self.lang_code)
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
        if len(text) > 500:
            print(f"📝 Text is long ({len(text)} chars), will chunk into smaller pieces", file=sys.stderr)
            return await self.generate_speech_chunked(text, speed)
            
        # 对于短文本，直接使用单块处理
        return await self.generate_speech_single(text, speed)
    
    def split_text_intelligently(self, text: str, max_chunk_size: int = 400) -> list:
        """智能分割文本，优先在句子边界分割"""
        chunks = []
        
        # 先按段落分割
        paragraphs = text.split('\n\n')
        current_chunk = ""
        
        for paragraph in paragraphs:
            # 如果当前块加上新段落不会太长，就添加
            if len(current_chunk + paragraph) <= max_chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                # 如果当前块不为空，先保存
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # 如果单个段落太长，需要进一步分割
                if len(paragraph) > max_chunk_size:
                    sentences = self.split_by_sentences(paragraph, max_chunk_size)
                    chunks.extend(sentences)
                else:
                    current_chunk = paragraph + "\n\n"
        
        # 添加最后一个块
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def split_by_sentences(self, text: str, max_chunk_size: int) -> list:
        """按句子分割文本"""
        import re
        
        # 按句子分割（句号、问号、感叹号）
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk + sentence) <= max_chunk_size:
                current_chunk += sentence + " "
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # 如果单个句子太长，按逗号分割
                if len(sentence) > max_chunk_size:
                    sub_chunks = self.split_by_commas(sentence, max_chunk_size)
                    chunks.extend(sub_chunks)
                else:
                    current_chunk = sentence + " "
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def split_by_commas(self, text: str, max_chunk_size: int) -> list:
        """按逗号分割文本"""
        parts = text.split(', ')
        chunks = []
        current_chunk = ""
        
        for part in parts:
            if len(current_chunk + part) <= max_chunk_size:
                current_chunk += part + ", "
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.rstrip(', '))
                    current_chunk = ""
                
                # 如果单个部分还是太长，强制分割
                if len(part) > max_chunk_size:
                    while len(part) > max_chunk_size:
                        chunks.append(part[:max_chunk_size])
                        part = part[max_chunk_size:]
                    if part:
                        current_chunk = part + ", "
                else:
                    current_chunk = part + ", "
        
        if current_chunk.strip():
            chunks.append(current_chunk.rstrip(', '))
        
        return chunks
    
    async def generate_speech_chunked(self, text: str, speed: float = 1.0) -> str:
        """分块生成音频并拼接"""
        chunks = self.split_text_intelligently(text)
        print(f"🧩 Split text into {len(chunks)} chunks", file=sys.stderr)
        
        audio_chunks = []
        
        for i, chunk in enumerate(chunks):
            print(f"🎵 Processing chunk {i+1}/{len(chunks)}: {len(chunk)} chars", file=sys.stderr)
            
            try:
                # 为每个块生成音频
                chunk_audio_hex = await self.generate_speech_single(chunk, speed)
                
                # 将十六进制转换为字节
                chunk_audio_bytes = bytes.fromhex(chunk_audio_hex)
                
                # 解析WAV文件，提取音频数据部分（跳过WAV头）
                if chunk_audio_bytes.startswith(b'RIFF'):
                    # 找到data块的位置
                    data_pos = chunk_audio_bytes.find(b'data')
                    if data_pos == -1:
                        print(f"❌ No data chunk found in audio file", file=sys.stderr)
                        continue
                    
                    # data块头部包含 'data' + 4字节大小信息
                    data_start = data_pos + 8
                    
                    # 验证data块大小
                    if data_start >= len(chunk_audio_bytes):
                        print(f"❌ Invalid data chunk position", file=sys.stderr)
                        continue
                        
                    audio_data = chunk_audio_bytes[data_start:]
                    audio_chunks.append(audio_data)
                    print(f"✅ Extracted {len(audio_data)} bytes of audio data from chunk", file=sys.stderr)
                else:
                    # 如果不是标准WAV格式，直接使用
                    audio_chunks.append(chunk_audio_bytes)
                    print(f"✅ Using raw audio data: {len(chunk_audio_bytes)} bytes", file=sys.stderr)
                
                print(f"✅ Chunk {i+1} completed ({len(audio_data)} bytes)", file=sys.stderr)
                
            except Exception as e:
                print(f"❌ Chunk {i+1} failed: {e}", file=sys.stderr)
                # 继续处理其他块
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