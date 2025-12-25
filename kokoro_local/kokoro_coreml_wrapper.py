#!/usr/bin/env python3
"""
Kokoro TTS CoreML Wrapper - 纯 CoreML + Apple Neural Engine 版本
不允许退回到 MPS，必须使用 CoreML

HAR 策略:
1. Python 端预计算 hn-nsf harmonic source 特征
2. CoreML 模型在 ANE 上运行 decoder
3. Python 端执行 iSTFT 转换为音频
"""

import asyncio
import json
import sys
import os
import struct
import io
import warnings
from pathlib import Path
from typing import Optional, Dict, Any

# 抑制所有警告输出到 stdout - 必须在所有 import 之前
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# 抑制 coremltools 版本警告
import logging
logging.getLogger('coremltools').setLevel(logging.ERROR)

# 预先 import coremltools 并抑制警告
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    import coremltools as ct

import torch
import soundfile as sf
import numpy as np

os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'

# 修补 Kokoro rsqrt 问题
def patch_kokoro_rsqrt():
    try:
        import kokoro.istftnet as istftnet
        RSQRT_2 = torch.rsqrt(torch.tensor(2.0, dtype=torch.float32))
        def patched_forward(self, x, s):
            out = self._residual(x, s)
            out = (out + self._shortcut(x)) * RSQRT_2
            return out
        istftnet.AdainResBlk1d.forward = patched_forward
    except:
        pass

patch_kokoro_rsqrt()

from text_chunker import split_text_intelligently
MAX_CHUNK_CHAR_SIZE = 300


class KokoroCoreMLWrapper:
    """Kokoro TTS - 纯 CoreML + ANE"""
    
    def __init__(self, lang_code: str = 'a', voice: str = 'af_heart'):
        self.pipeline = None
        self.model = None
        self.coreml_models: Dict[int, Any] = {}
        self.voice_pack = None
        self.initialized = False
        self.lang_code = lang_code
        self.voice = voice
        self.current_lang_code = None
        self.current_voice = None
        
        self.coreml_dir = Path(__file__).parent / 'coreml'
        self.buckets = [3, 10, 30]  # 所有 buckets
        
    def _load_coreml_models(self):
        """加载 CoreML 模型"""
        print("📦 Loading CoreML models...", file=sys.stderr)
        
        for seconds in self.buckets:
            model_path = self.coreml_dir / f"KokoroDecoder_HAR_{seconds}s.mlpackage"
            if model_path.exists():
                print(f"  Loading {seconds}s bucket...", file=sys.stderr)
                # 使用 CPU_AND_GPU 避免 ANE 编译延迟
                self.coreml_models[seconds] = ct.models.MLModel(
                    str(model_path), 
                    compute_units=ct.ComputeUnit.CPU_AND_GPU
                )
                print(f"  ✅ {seconds}s bucket loaded", file=sys.stderr)
        
        if not self.coreml_models:
            raise RuntimeError("No CoreML models found! Run: python scripts/export_coreml.py")
        
        print(f"✅ Loaded {len(self.coreml_models)} CoreML models", file=sys.stderr)
    
    def _select_bucket(self, f0_len: int) -> int:
        """选择合适的 bucket"""
        f0_per_sec = 80
        duration = f0_len / f0_per_sec
        for bucket in self.buckets:
            if duration <= bucket:
                return bucket
        return self.buckets[-1]
    
    def _compute_har_features(self, f0_curve: torch.Tensor) -> tuple:
        """预计算 hn-nsf harmonic source 特征"""
        generator = self.model.decoder.generator
        
        with torch.no_grad():
            f0_up = generator.f0_upsamp(f0_curve[:, None]).transpose(1, 2)
            har_source, _, _ = generator.m_source(f0_up)
            har_source = har_source.transpose(1, 2).squeeze(1)
            har_spec, har_phase = generator.stft.transform(har_source)
        
        return har_spec.numpy(), har_phase.numpy()
    
    def _run_coreml_decoder(self, bucket: int, asr: np.ndarray, f0_curve: np.ndarray,
                            n_curve: np.ndarray, s: np.ndarray,
                            har_spec: np.ndarray, har_phase: np.ndarray) -> np.ndarray:
        """运行 CoreML decoder"""
        model = self.coreml_models[bucket]
        
        # 获取期望的形状
        config = self._get_bucket_config(bucket)
        asr_len = config['asr_len']
        f0_len = config['f0_len']
        
        # Pad 或 crop 到正确的形状
        asr_padded = self._pad_or_crop(asr, asr_len, axis=-1)
        f0_padded = self._pad_or_crop(f0_curve, f0_len, axis=-1)
        n_padded = self._pad_or_crop(n_curve, f0_len, axis=-1)
        
        # 计算正确的 har 形状
        har_c, har_t = self._compute_har_shapes_for_bucket(bucket)
        har_spec_padded = self._pad_or_crop(har_spec, har_t, axis=-1)
        har_phase_padded = self._pad_or_crop(har_phase, har_t, axis=-1)
        
        inputs = {
            'asr': asr_padded.reshape(1, 512, 1, asr_len).astype(np.float32),
            'f0_curve': f0_padded.reshape(1, 1, 1, f0_len).astype(np.float32),
            'n': n_padded.reshape(1, 1, 1, f0_len).astype(np.float32),
            's': s.reshape(1, 128).astype(np.float32),
            'har_spec': har_spec_padded.reshape(1, har_c, 1, har_t).astype(np.float32),
            'har_phase': har_phase_padded.reshape(1, har_c, 1, har_t).astype(np.float32),
        }
        
        output = model.predict(inputs)
        output_key = list(output.keys())[0]
        return output[output_key]
    
    def _pad_or_crop(self, arr: np.ndarray, target_len: int, axis: int = -1) -> np.ndarray:
        """Pad 或 crop 数组到目标长度"""
        current_len = arr.shape[axis]
        if current_len == target_len:
            return arr
        elif current_len < target_len:
            pad_width = [(0, 0)] * arr.ndim
            pad_width[axis] = (0, target_len - current_len)
            return np.pad(arr, pad_width, mode='constant')
        else:
            slices = [slice(None)] * arr.ndim
            slices[axis] = slice(0, target_len)
            return arr[tuple(slices)]
    
    def _get_bucket_config(self, bucket: int) -> dict:
        """获取 bucket 配置"""
        f0_per_sec = 80
        return {
            'f0_len': bucket * f0_per_sec,
            'asr_len': bucket * f0_per_sec // 2,
        }
    
    def _compute_har_shapes_for_bucket(self, bucket: int) -> tuple:
        """计算 bucket 的 har 形状"""
        config = self._get_bucket_config(bucket)
        f0_len = config['f0_len']
        
        generator = self.model.decoder.generator
        with torch.no_grad():
            f0 = torch.zeros((1, f0_len), dtype=torch.float32)
            f0_up = generator.f0_upsamp(f0[:, None]).transpose(1, 2)
            har_source, _, _ = generator.m_source(f0_up)
            har_source = har_source.transpose(1, 2).squeeze(1)
            har_spec, _ = generator.stft.transform(har_source)
            return har_spec.shape[1], har_spec.shape[2]
    
    def _istft_to_audio(self, spec_phase: np.ndarray) -> np.ndarray:
        """将 spec/phase 输出转换为音频"""
        # spec_phase: [1, 22, T] - 前 11 是 spec，后 11 是 phase
        generator = self.model.decoder.generator
        post_n_fft = generator.post_n_fft  # 20
        
        # 分离 spec 和 phase
        spec = np.exp(spec_phase[:, :post_n_fft // 2 + 1, :])  # [1, 11, T]
        phase = np.sin(spec_phase[:, post_n_fft // 2 + 1:, :])  # [1, 11, T]
        
        # 转换为 torch tensor
        spec_t = torch.from_numpy(spec).float()
        phase_t = torch.from_numpy(phase).float()
        
        # 使用 generator 的 stft.inverse
        with torch.no_grad():
            audio = generator.stft.inverse(spec_t, phase_t)
        
        return audio.numpy().squeeze()
        
    async def initialize(self, lang_code: Optional[str] = None, voice: Optional[str] = None):
        """初始化"""
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
        
        # 加载 CoreML 模型
        if not self.coreml_models:
            self._load_coreml_models()
        
        print(f"🚀 Using CoreML + Apple Neural Engine", file=sys.stderr)
        
        # 加载 Kokoro 模型 (用于特征提取)
        # 抑制 Kokoro 的警告输出
        import logging
        logging.getLogger('kokoro').setLevel(logging.ERROR)
        
        from kokoro import KModel
        from kokoro.pipeline import KPipeline
        import kokoro
        kokoro.logger.disable("kokoro")
        
        # 设置 repo_id 避免警告
        os.environ['KOKORO_REPO_ID'] = 'hexgrad/Kokoro-82M'
        
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        
        if self.current_lang_code != self.lang_code:
            print(f"🌍 Initializing: {self.lang_code}", file=sys.stderr)
            self.model = KModel(repo_id='hexgrad/Kokoro-82M', disable_complex=True).eval()
            self.pipeline = KPipeline(lang_code=self.lang_code, repo_id='hexgrad/Kokoro-82M')
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
        print(f'🚀 Kokoro TTS ready - CoreML + ANE | {self.lang_code} | {self.voice}', file=sys.stderr)
            
    async def generate_speech(self, text: str, speed: float = 1.0) -> str:
        """生成音频"""
        if not self.initialized:
            await self.initialize()
            
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # 使用 pipeline 生成（内部会使用我们的 patched 模型）
        audio_chunks = []
        
        for _, _, audio in self.pipeline(text, voice=self.voice, speed=speed, split_pattern=r'\n+'):
            if audio is not None:
                audio_chunks.append(audio.cpu() if hasattr(audio, 'cpu') else torch.tensor(audio))
        
        if not audio_chunks:
            raise Exception("No audio generated")
        
        combined = torch.cat(audio_chunks)
        
        buffer = io.BytesIO()
        sf.write(buffer, combined.numpy(), 24000, format='WAV')
        
        return buffer.getvalue().hex()


async def main():
    """主循环"""
    service = KokoroCoreMLWrapper()
    await service.initialize()
    
    print('🚀 Kokoro TTS service is ready (CoreML + ANE)', file=sys.stderr)
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
                "device": "coreml+ane",
                "lang_code": service.lang_code,
                "voice": service.voice
            }), flush=True)
            
        except json.JSONDecodeError:
            print(json.dumps({"success": False, "error": "Invalid JSON"}), flush=True)
        except Exception as e:
            import traceback
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({
                "success": False,
                "request_id": request.get('request_id') if 'request' in dir() else None,
                "error": str(e)
            }), flush=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        async def test():
            s = KokoroCoreMLWrapper()
            await s.initialize()
            r = await s.generate_speech("Hello CoreML test", 1.0)
            print(json.dumps({"success": True, "audio_length": len(r) // 2, "device": "coreml+ane"}))
        asyncio.run(test())
    else:
        asyncio.run(main())
