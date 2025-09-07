#!/usr/bin/env python3
"""
Misaki/Espeak兼容性修复脚本
解决 AttributeError: set_data_path 方法不存在的问题
"""

import os
import sys
import subprocess
import traceback
from pathlib import Path

def check_environment():
    """检查当前环境"""
    print("=== 环境检查 ===")
    print(f"Python版本: {sys.version}")
    print(f"当前工作目录: {os.getcwd()}")
    
    # 检查关键包是否存在
    packages = ['phonemizer', 'espeakng_loader', 'misaki', 'torch']
    for pkg in packages:
        try:
            __import__(pkg)
            print(f"✓ {pkg} 已安装")
        except ImportError:
            print(f"✗ {pkg} 未安装")
    
def fix_misaki_espeak():
    """修复misaki espeak兼容性问题"""
    print("\n=== 修复misaki/espeak兼容性 ===")
    
    try:
        # 方法1: 检查phonemizer版本并降级如果需要
        import phonemizer
        print(f"当前phonemizer版本: {phonemizer.__version__}")
        
        # 检查EspeakWrapper是否有set_data_path方法
        from phonemizer.backend.espeak.wrapper import EspeakWrapper
        if hasattr(EspeakWrapper, 'set_data_path'):
            print("✓ EspeakWrapper.set_data_path 方法存在")
            
            # 方法2: 测试手动导入misaki.espeak
            try:
                import misaki.espeak
                print("✓ misaki.espeak 导入成功")
                return True
            except AttributeError as e:
                print(f"✗ misaki.espeak 导入时发生AttributeError: {e}")
                return fix_method_2()
            except Exception as e:
                print(f"✗ misaki.espeak 导入失败: {e}")
                return fix_method_3()
        else:
            print("✗ EspeakWrapper.set_data_path 方法不存在")
            return fix_method_1()
            
    except Exception as e:
        print(f"✗ 修复过程中发生错误: {e}")
        traceback.print_exc()
        return False

def fix_method_1():
    """方法1: 降级phonemizer到兼容版本"""
    print("\n--- 修复方法1: 降级phonemizer ---")
    try:
        # 卸载当前版本并安装兼容版本
        subprocess.run([sys.executable, '-m', 'pip', 'uninstall', 'phonemizer', '-y'], check=True)
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'phonemizer==3.2.1'], check=True)
        print("✓ phonemizer已降级到3.2.1")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ phonemizer降级失败: {e}")
        return False

def fix_method_2():
    """方法2: 修改misaki.espeak源码"""
    print("\n--- 修复方法2: 修改misaki.espeak源码 ---")
    
    try:
        import misaki
        misaki_path = Path(misaki.__file__).parent / 'espeak.py'
        
        if not misaki_path.exists():
            print(f"✗ 找不到misaki espeak.py文件: {misaki_path}")
            return False
            
        # 读取原文件内容
        with open(misaki_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否需要修改
        if 'EspeakWrapper.set_data_path' in content:
            # 创建修复版本
            fixed_content = content.replace(
                'EspeakWrapper.set_data_path(espeakng_loader.get_data_path())',
                '''# EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
try:
    EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
except AttributeError:
    # Fallback for older phonemizer versions
    EspeakWrapper._ESPEAK_DATA_PATH = espeakng_loader.get_data_path()'''
            )
            
            # 备份原文件
            backup_path = misaki_path.with_suffix('.py.backup')
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ 原文件已备份到: {backup_path}")
            
            # 写入修复后的内容
            with open(misaki_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"✓ misaki espeak.py已修复")
            
            # 测试修复是否成功
            try:
                import importlib
                importlib.reload(misaki.espeak)
                print("✓ misaki.espeak重新加载成功")
                return True
            except Exception as e:
                print(f"✗ 重新加载失败: {e}")
                # 恢复原文件
                with open(misaki_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return False
        else:
            print("✓ misaki espeak.py 不需要修改")
            return True
            
    except Exception as e:
        print(f"✗ 修改misaki espeak.py失败: {e}")
        traceback.print_exc()
        return False

def fix_method_3():
    """方法3: 重新安装完整的espeak-ng环境"""
    print("\n--- 修复方法3: 重新安装espeak-ng环境 ---")
    
    commands = [
        # 更新包管理器
        "sudo apt-get update",
        # 安装espeak-ng和开发包
        "sudo apt-get install -y espeak-ng espeak-ng-data libespeak-ng-dev",
        # 重新安装python包
        f"{sys.executable} -m pip uninstall -y phonemizer espeakng-loader misaki",
        f"{sys.executable} -m pip install phonemizer espeakng-loader",
        f"{sys.executable} -m pip install misaki==2.0.0"
    ]
    
    for cmd in commands:
        try:
            print(f"执行: {cmd}")
            result = subprocess.run(cmd.split(), check=True, capture_output=True, text=True)
            print(f"✓ 成功")
        except subprocess.CalledProcessError as e:
            print(f"✗ 失败: {e}")
            print(f"stderr: {e.stderr}")
            return False
    
    return True

def test_kokoro_import():
    """测试Kokoro导入是否正常"""
    print("\n=== 测试Kokoro导入 ===")
    try:
        # 添加kokoro路径
        kokoro_path = '/home/ubuntu/english-listening-trainer/kokoro-main-ref'
        if os.path.exists(kokoro_path):
            sys.path.insert(0, kokoro_path)
        else:
            # 使用本地路径
            kokoro_path = os.path.join(os.path.dirname(__file__), '..', 'kokoro-main-ref')
            if os.path.exists(kokoro_path):
                sys.path.insert(0, os.path.abspath(kokoro_path))
        
        from kokoro.js import KPipeline
        print("✓ KPipeline导入成功")
        
        # 测试创建pipeline (CPU模式避免CUDA问题)
        pipeline = KPipeline(lang_code='en-us', device='cpu')  
        print("✓ KPipeline CPU模式创建成功")
        
        # 如果CUDA可用，测试GPU模式
        import torch
        if torch.cuda.is_available():
            try:
                pipeline_gpu = KPipeline(lang_code='en-us', device='cuda')
                print("✓ KPipeline GPU模式创建成功")
            except Exception as e:
                print(f"⚠ KPipeline GPU模式创建失败: {e}")
        
        return True
        
    except Exception as e:
        print(f"✗ Kokoro导入失败: {e}")
        traceback.print_exc()
        return False

def main():
    """主函数"""
    print("Misaki/Espeak兼容性修复脚本")
    print("=" * 50)
    
    # 检查环境
    check_environment()
    
    # 尝试修复
    if fix_misaki_espeak():
        print("\n✓ misaki/espeak兼容性问题已修复")
        
        # 测试Kokoro导入
        if test_kokoro_import():
            print("\n🎉 所有修复完成！Kokoro TTS现在应该可以正常工作了")
            return True
        else:
            print("\n⚠ misaki修复成功，但Kokoro导入仍有问题")
            return False
    else:
        print("\n✗ 修复失败，请检查错误信息并手动处理")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)