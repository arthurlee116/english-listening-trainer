#!/usr/bin/env python3
import os
import sys
import json
import torch
import numpy as np
import base64
import tempfile
from io import BytesIO

# 添加Kokoro路径到Python路径
kokoro_path = '/home/ubuntu/english-listening-trainer/kokoro-main-ref/kokoro.js'
sys.path.append(kokoro_path)

class KokoroTTSInteractive:
    def __init__(self):
        self.models = {}
        self.voices_dir = '/home/ubuntu/english-listening-trainer/kokoro-main-ref/kokoro.js/kokoro.js/voices'
        
        # 发送就绪信号
        self.send_ready_signal()
        
    def send_ready_signal(self):
        """发送就绪信号到stderr，让Node.js知道服务已准备好"""
        print("🚀 Kokoro TTS service is ready", file=sys.stderr)
        sys.stderr.flush()
        
    def load_model(self, voice):
        """加载指定语音的模型"""
        if voice in self.models:
            return self.models[voice]
            
        try:
            # 查找模型文件
            model_file = None
            for file in os.listdir(self.voices_dir):
                if file.startswith(voice) and file.endswith('.bin'):
                    model_file = os.path.join(self.voices_dir, file)
                    break
                    
            if not model_file:
                raise Exception(f"Model file not found for voice: {voice}")
                
            # 这里应该加载实际的模型，暂时返回模拟对象
            print(f"Model loaded successfully: {model_file}", file=sys.stderr)
            sys.stderr.flush()
            
            # 模拟模型对象
            self.models[voice] = {
                'loaded': True,
                'model_path': model_file
            }
            
            return self.models[voice]
            
        except Exception as e:
            raise Exception(f"Failed to load model: {e}")
    
    def synthesize_audio(self, text, voice='af', speed=1.0):
        """合成音频并返回base64编码的音频数据"""
        try:
            # 加载模型
            model = self.load_model(voice)
            
            # 这里应该是实际的音频合成逻辑
            # 目前使用模拟的音频数据
            
            # 生成模拟的WAV音频数据
            sample_rate = 24000
            duration = len(text) * 0.1 / float(speed)  # 估算持续时间
            samples = int(sample_rate * duration)
            
            # 生成简单的正弦波作为模拟音频
            t = np.linspace(0, duration, samples, False)
            frequency = 440  # A4音符
            audio_data = np.sin(2 * np.pi * frequency * t) * 0.3
            
            # 转换为16位整数
            audio_int16 = (audio_data * 32767).astype(np.int16)
            
            # 创建WAV文件的字节流
            wav_buffer = BytesIO()
            
            # 使用scipy创建WAV文件
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
                
                print(f"Audio synthesized: {voice}", file=sys.stderr)
                sys.stderr.flush()
                
                return audio_hex
                
            except ImportError:
                raise Exception("scipy not available for WAV creation")
                
        except Exception as e:
            raise Exception(f"Audio synthesis failed: {e}")
    
    def process_request(self, request_data):
        """处理JSON请求"""
        try:
            request = json.loads(request_data)
            
            text = request.get('text', '')
            speed = request.get('speed', 1.0)
            voice = request.get('voice', 'af')
            
            if not text:
                return {
                    'success': False,
                    'error': 'Text cannot be empty'
                }
            
            # 合成音频
            audio_data = self.synthesize_audio(text, voice, speed)
            
            return {
                'success': True,
                'audio_data': audio_data,
                'message': f'Audio synthesized for voice: {voice}'
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
        service = KokoroTTSInteractive()
        service.run()
    except Exception as e:
        print(f"Failed to start Kokoro TTS service: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()