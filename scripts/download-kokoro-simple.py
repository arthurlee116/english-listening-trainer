#!/usr/bin/env python3
"""
简单的 Kokoro 模型下载脚本
不需要 huggingface-cli，只需要 requests
"""

import os
import sys
from pathlib import Path
import urllib.request
import json

MODEL_DIR = Path("./kokoro-models/Kokoro-82M")
REPO_ID = "hexgrad/Kokoro-82M"
BASE_URL = f"https://huggingface.co/{REPO_ID}/resolve/main"

# 必需的文件列表（根据 https://huggingface.co/hexgrad/Kokoro-82M/tree/main）
REQUIRED_FILES = [
    "kokoro-v1_0.pth",  # 主模型文件
    "VOICES.md",       # 语音配置
]

# 可选但推荐的文件
OPTIONAL_FILES = [
    "README.md",
]

def download_file(url: str, dest: Path):
    """下载文件并显示进度"""
    print(f"📥 下载: {dest.name}")
    
    try:
        # 获取文件大小
        with urllib.request.urlopen(url) as response:
            total_size = int(response.headers.get('content-length', 0))
            
            # 下载文件
            dest.parent.mkdir(parents=True, exist_ok=True)
            
            with open(dest, 'wb') as f:
                downloaded = 0
                chunk_size = 8192
                
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # 显示进度
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        mb_downloaded = downloaded / 1024 / 1024
                        mb_total = total_size / 1024 / 1024
                        print(f"   {percent:.1f}% ({mb_downloaded:.1f}/{mb_total:.1f} MB)", end='\r')
        
        print(f"\n✅ 完成: {dest.name}")
        return True
        
    except Exception as e:
        print(f"\n❌ 失败: {e}")
        return False

def main():
    print("📥 下载 Kokoro-82M 模型...")
    print(f"📁 目标目录: {MODEL_DIR}")
    print()
    
    # 创建目录
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    # 下载必需文件
    success_count = 0
    total_files = len(REQUIRED_FILES)
    
    for filename in REQUIRED_FILES:
        url = f"{BASE_URL}/{filename}"
        dest = MODEL_DIR / filename
        
        # 跳过已存在的文件
        if dest.exists():
            print(f"⏭️  跳过已存在: {filename}")
            success_count += 1
            continue
        
        if download_file(url, dest):
            success_count += 1
    
    # 下载可选文件
    print()
    print("📥 下载可选文件...")
    for filename in OPTIONAL_FILES:
        url = f"{BASE_URL}/{filename}"
        dest = MODEL_DIR / filename
        
        if dest.exists():
            print(f"⏭️  跳过已存在: {filename}")
            continue
        
        download_file(url, dest)  # 失败也不影响
    
    print()
    print(f"✅ 下载完成: {success_count}/{total_files} 必需文件")
    
    # 显示下载的文件
    print()
    print("📦 下载的文件:")
    for file in MODEL_DIR.iterdir():
        if file.is_file():
            size_mb = file.stat().st_size / 1024 / 1024
            print(f"   {file.name}: {size_mb:.1f} MB")
    
    # 计算总大小
    total_size = sum(f.stat().st_size for f in MODEL_DIR.iterdir() if f.is_file())
    print()
    print(f"📊 总大小: {total_size / 1024 / 1024:.1f} MB")
    
    print()
    print("💡 下一步:")
    print("   ./scripts/upload-kokoro-model.sh")

if __name__ == "__main__":
    main()
