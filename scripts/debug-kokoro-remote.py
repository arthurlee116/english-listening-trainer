#!/usr/bin/env python3
"""
远程Kokoro TTS调试脚本
用于排查misaki/espeak兼容性问题
"""

import sys
import subprocess
import traceback

def run_debug_check():
    """运行调试检查"""
    print("=== Kokoro TTS 远程调试 ===")
    
    # 1. 检查Python版本
    print(f"Python版本: {sys.version}")
    
    # 2. 检查关键模块导入
    modules_to_check = [
        'torch',
        'phonemizer',
        'espeakng_loader', 
        'misaki',
        'misaki.espeak'
    ]
    
    for module in modules_to_check:
        try:
            __import__(module)
            print(f"✓ {module} - 导入成功")
        except ImportError as e:
            print(f"✗ {module} - 导入失败: {e}")
        except Exception as e:
            print(f"✗ {module} - 其他错误: {e}")
    
    # 3. 检查EspeakWrapper方法
    try:
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        methods = [method for method in dir(EspeakWrapper) if not method.startswith('_')]
        print(f"✓ EspeakWrapper可用方法: {methods}")
        print(f"✓ 有set_data_path方法: {hasattr(EspeakWrapper, 'set_data_path')}")
    except Exception as e:
        print(f"✗ EspeakWrapper检查失败: {e}")
        traceback.print_exc()
    
    # 4. 测试misaki.espeak特定导入
    try:
        import espeakng_loader
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        
        print(f"✓ espeakng库路径: {espeakng_loader.get_library_path()}")
        print(f"✓ espeakng数据路径: {espeakng_loader.get_data_path()}")
        
        # 手动执行misaki.espeak中的关键代码
        EspeakWrapper.set_library(espeakng_loader.get_library_path())
        EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
        print("✓ EspeakWrapper配置成功")
        
    except Exception as e:
        print(f"✗ espeakng配置失败: {e}")
        traceback.print_exc()
    
    # 5. 测试Kokoro导入
    print("\n=== 测试Kokoro导入 ===")
    try:
        sys.path.insert(0, '/home/ubuntu/english-listening-trainer/kokoro-main-ref')
        from kokoro.js import KPipeline
        print("✓ KPipeline导入成功")
        
        # 测试创建pipeline
        pipeline = KPipeline(lang_code='en-us', device='cpu')
        print("✓ KPipeline创建成功")
        
    except Exception as e:
        print(f"✗ Kokoro导入失败: {e}")
        traceback.print_exc()
    
    # 6. 测试CUDA可用性
    print("\n=== 测试CUDA ===")
    try:
        import torch
        print(f"✓ CUDA可用: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"✓ CUDA设备数量: {torch.cuda.device_count()}")
            print(f"✓ 当前CUDA设备: {torch.cuda.current_device()}")
            print(f"✓ 设备名称: {torch.cuda.get_device_name(0)}")
    except Exception as e:
        print(f"✗ CUDA检查失败: {e}")

if __name__ == "__main__":
    run_debug_check()