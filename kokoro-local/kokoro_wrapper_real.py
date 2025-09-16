#!/usr/bin/env python3
import os
import sys
import json
import torch
import numpy as np
import base64
import tempfile
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')

# 添加Kokoro路径到Python路径
kokoro_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'kokoro-main-ref', 'kokoro.js')
if not os.path.exists(kokoro_path):
    kokoro_path = '/home/ubuntu/kokoro-main-ref/kokoro.js'
sys.path.append(kokoro_path)

# 导入真实的Kokoro模块
try:
    from kokoro.model import KModel
    from kokoro.pipeline import KPipeline
    from kokoro import ALIASES, LANG_CODES
    KOKORO_AVAILABLE = True
except ImportError as e:
    print(f"❌ Failed to import Kokoro modules: {e}", file=sys.stderr)
    KOKORO_AVAILABLE = False

class KokoroTTSReal:
    def __init__(self):
        self.models = {}
        self.pipelines = {}
        self.device = None
        self.model = None
        
        # 自动检测设备
        self.setup_device()
        
        # 初始化模型
        if KOKORO_AVAILABLE:
            self.initialize_model()
        
        # 发送就绪信号
        self.send_ready_signal()
        
    def setup_device(self):
        """设置计算设备，优先使用GPU"""
        try:
            # 设置代理（如果可用）
            if os.environ.get('https_proxy') or os.environ.get('http_proxy'):
                print(f"🌐 Using proxy: {os.environ.get('https_proxy', os.environ.get('http_proxy'))}", file=sys.stderr)
            
            if torch.cuda.is_available():
                self.device = 'cuda'
                gpu_name = torch.cuda.get_device_name(0)
                print(f"🚀 Using GPU: {gpu_name}", file=sys.stderr)
                print(f"📊 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB", file=sys.stderr)
                print(f"🔥 CUDA Version: {torch.version.cuda}", file=sys.stderr)
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                self.device = 'mps'
                print("🍎 Using Apple Silicon MPS", file=sys.stderr)
            else:
                self.device = 'cpu'
                print("💻 Using CPU (slow)", file=sys.stderr)
            
            sys.stderr.flush()
            
        except Exception as e:
            self.device = 'cpu'
            print(f"⚠️ Device detection failed, falling back to CPU: {e}", file=sys.stderr)
            sys.stderr.flush()
    
    def send_ready_signal(self):
        """发送就绪信号到stderr，让Node.js知道服务已准备好"""
        if KOKORO_AVAILABLE and self.model:
            print("🚀 Kokoro TTS service is ready with real GPU acceleration", file=sys.stderr)
        else:
            print("⚠️ Kokoro TTS service ready but using fallback mode", file=sys.stderr)
        sys.stderr.flush()
        
    def initialize_model(self):
        """初始化Kokoro模型"""
        try:
            print("🔄 Initializing Kokoro model...", file=sys.stderr)
            sys.stderr.flush()
            
            # 创建模型实例，优先使用本地模型
            local_model_path = '/home/ubuntu/Kokoro-82M'
            if os.path.exists(os.path.join(local_model_path, 'kokoro-v1_0.pth')):
                print(f"📂 Using local model at: {local_model_path}", file=sys.stderr)
                # 对于本地模型，需要设置环境变量让HuggingFace使用本地缓存
                os.environ['HF_HOME'] = local_model_path
                os.environ['HF_HUB_CACHE'] = local_model_path
                # 创建符号链接让HuggingFace找到本地模型
                hf_cache_dir = os.path.expanduser('~/.cache/huggingface/hub')
                os.makedirs(hf_cache_dir, exist_ok=True)
                local_link = os.path.join(hf_cache_dir, 'models--hexgrad--Kokoro-82M')
                if not os.path.exists(local_link):
                    try:
                        os.symlink(local_model_path, local_link)
                        print(f"🔗 Created symlink: {local_link} -> {local_model_path}", file=sys.stderr)
                    except OSError:
                        pass  # 可能已存在或权限不足
                self.model = KModel(
                    repo_id='hexgrad/Kokoro-82M',
                    disable_complex=False
                )
            else:
                print("🌐 Using HuggingFace model: hexgrad/Kokoro-82M", file=sys.stderr)
                self.model = KModel(
                    repo_id='hexgrad/Kokoro-82M',
                    disable_complex=False
                )
            
            # 移动到指定设备
            if self.device != 'cpu':
                self.model = self.model.to(self.device)
                
            print(f"✅ Model initialized on {self.device}", file=sys.stderr)
            sys.stderr.flush()
            
        except Exception as e:
            print(f"❌ Model initialization failed: {e}", file=sys.stderr)
            sys.stderr.flush()
            self.model = None
    
    def get_pipeline(self, lang_code='en-us', voice='af'):
        """获取或创建语言管道"""
        pipeline_key = f"{lang_code}_{voice}"
        
        if pipeline_key in self.pipelines:
            return self.pipelines[pipeline_key]
            
        try:
            print(f"🔄 Creating pipeline for {lang_code} with voice {voice}...", file=sys.stderr)
            sys.stderr.flush()
            
            # 创建管道
            pipeline = KPipeline(
                lang_code=lang_code,
                model=self.model if self.model else True,
                device=self.device if self.device != 'cpu' else None,
                repo_id='hexgrad/Kokoro-82M'  # 使用标准repo_id，本地文件通过缓存访问
            )
            
            self.pipelines[pipeline_key] = pipeline
            
            print(f"✅ Pipeline created for {lang_code}_{voice}", file=sys.stderr)
            sys.stderr.flush()
            
            return pipeline
            
        except Exception as e:
            print(f"❌ Pipeline creation failed for {lang_code}_{voice}: {e}", file=sys.stderr)
            sys.stderr.flush()
            return None
    
    def synthesize_audio(self, text, voice='af', speed=1.0, lang_code='en-us'):
        """使用真实Kokoro模型合成音频"""
        try:
            if not KOKORO_AVAILABLE:
                raise Exception("Kokoro modules not available")
                
            if not self.model:
                raise Exception("Model not initialized")
            
            print(f"🎤 Synthesizing audio: {text[:50]}...", file=sys.stderr)
            print(f"🎭 Voice: {voice}, Language: {lang_code}, Speed: {speed}", file=sys.stderr)
            sys.stderr.flush()
            
            # 获取管道
            pipeline = self.get_pipeline(lang_code, voice)
            if not pipeline:
                raise Exception(f"Failed to create pipeline for {lang_code}")
            
            # 使用管道生成音频
            results = list(pipeline(text, voice=voice, speed=speed))
            
            if not results or len(results) == 0:
                raise Exception("No audio generated")
            
            # 获取最后一段音频（完整的音频）
            graphemes, phonemes, audio = results[-1]
            
            if audio is None:
                raise Exception("No audio data generated")
            
            # 确保音频在CPU上处理
            if isinstance(audio, torch.Tensor):
                audio = audio.cpu()
            
            # 转换为numpy数组
            audio_array = audio.numpy() if hasattr(audio, 'numpy') else np.array(audio)
            
            # 确保音频数据是float32格式
            if audio_array.dtype != np.float32:
                audio_array = audio_array.astype(np.float32)
            
            # 归一化音频到[-1, 1]范围
            max_val = np.abs(audio_array).max()
            if max_val > 0:
                audio_array = audio_array / max_val * 0.95  # 留一些余量避免削波
            
            # Kokoro默认采样率是24000Hz
            sample_rate = 24000
            
            # 转换为16位整数
            audio_int16 = (audio_array * 32767).astype(np.int16)
            
            print(f"🎵 Audio generated: {len(audio_int16)} samples at {sample_rate}Hz", file=sys.stderr)
            sys.stderr.flush()
            
            # 创建WAV文件
            try:
                import scipy.io.wavfile
                
                # 写入临时文件
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                    scipy.io.wavfile.write(tmp_file.name, sample_rate, audio_int16)
                    
                    # 读取文件内容
                    with open(tmp_file.name, 'rb') as f:
                        audio_bytes = f.read()
                    
                    # 清理临时文件
                    os.unlink(tmp_file.name)
                
                # 转换为hex字符串
                audio_hex = audio_bytes.hex()
                
                print(f"✅ Audio synthesized successfully: {len(audio_hex)} hex chars", file=sys.stderr)
                print(f"📊 Audio size: {len(audio_bytes)} bytes", file=sys.stderr)
                sys.stderr.flush()
                
                return audio_hex
                
            except ImportError:
                raise Exception("scipy not available for WAV creation")
                
        except Exception as e:
            print(f"❌ Audio synthesis failed: {e}", file=sys.stderr)
            sys.stderr.flush()
            raise Exception(f"Audio synthesis failed: {e}")
    
    def process_request(self, request_data):
        """处理JSON请求"""
        try:
            request = json.loads(request_data)
            
            text = request.get('text', '')
            speed = request.get('speed', 1.0)
            voice = request.get('voice', 'af')
            lang_code = request.get('lang_code', 'en-us')
            
            if not text:
                return {
                    'success': False,
                    'error': 'Text cannot be empty'
                }
            
            # 合成音频
            audio_data = self.synthesize_audio(text, voice, speed, lang_code)
            
            return {
                'success': True,
                'audio_data': audio_data,
                'device': self.device,
                'message': f'Audio synthesized using {self.device} with voice: {voice}'
            }
            
        except json.JSONDecodeError:
            return {
                'success': False,
                'error': 'Invalid JSON request'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def run(self):
        """运行交互式服务"""
        while True:
            try:
                # 读取输入
                line = sys.stdin.readline()
                if not line:
                    break
                    
                line = line.strip()
                if not line:
                    continue
                
                # 处理请求
                response = self.process_request(line)
                
                # 发送响应
                print(json.dumps(response), flush=True)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                error_response = {
                    'success': False,
                    'error': f'Service error: {e}'
                }
                print(json.dumps(error_response), flush=True)

def main():
    """主函数"""
    try:
        service = KokoroTTSReal()
        service.run()
    except Exception as e:
        print(f"Failed to start Kokoro TTS service: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()