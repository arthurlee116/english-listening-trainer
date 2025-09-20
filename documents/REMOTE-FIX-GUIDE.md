# Kokoro TTS 远程修复指导

## 问题描述
当前Kokoro TTS系统在导入`misaki.espeak`时遇到AttributeError: `EspeakWrapper.set_data_path`方法不存在的问题。

## 快速修复步骤

### 1. 连接到远程服务器
```bash
ssh ubuntu@49.234.30.246
# 密码: Abcd.1234
```

### 2. 进入项目目录并拉取最新代码
```bash
cd /home/ubuntu/english-listening-trainer
git pull origin main
```

### 3. 运行自动修复脚本
```bash
python3 scripts/fix-misaki-espeak.py
```

如果自动修复脚本失败，请继续以下手动步骤：

## 手动修复方案

### 方案A: 降级phonemizer版本（推荐）
```bash
# 1. 卸载当前phonemizer版本
pip uninstall phonemizer -y

# 2. 安装兼容版本
pip install phonemizer==3.2.1

# 3. 测试导入
python3 -c "import misaki.espeak; print('Success')"
```

### 方案B: 修改misaki源码
```bash
# 1. 找到misaki espeak.py位置
python3 -c "import misaki; print(misaki.__file__)"

# 2. 编辑文件（假设路径为 ~/.local/lib/python3.x/site-packages/misaki/espeak.py）
nano ~/.local/lib/python3.x/site-packages/misaki/espeak.py

# 3. 将第10行：
# EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
# 
# 替换为：
try:
    EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
except AttributeError:
    # Fallback for older phonemizer versions  
    EspeakWrapper._ESPEAK_DATA_PATH = espeakng_loader.get_data_path()
```

### 方案C: 重新安装完整环境
```bash
# 1. 更新系统包
sudo apt-get update

# 2. 安装espeak-ng完整包
sudo apt-get install -y espeak-ng espeak-ng-data libespeak-ng-dev

# 3. 重新安装Python依赖
pip uninstall -y phonemizer espeakng-loader misaki
pip install phonemizer espeakng-loader
pip install misaki==2.0.0
```

## 验证修复结果

### 1. 测试基本导入
```bash
python3 -c "
import misaki.espeak
print('✓ misaki.espeak 导入成功')

from phonemizer.backend.espeak.wrapper import EspeakWrapper
print('✓ EspeakWrapper 导入成功')

import espeakng_loader
EspeakWrapper.set_library(espeakng_loader.get_library_path())
print('✓ espeak库配置成功')
"
```

### 2. 测试Kokoro TTS完整功能
```bash
python3 scripts/debug-kokoro-remote.py
```

### 3. 测试TTS服务
```bash
# 启动开发服务器
npm run dev

# 在另一个终端测试TTS API
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test", "voice": "en-us"}'
```

## 常见问题排除

### Q1: 仍然出现set_data_path错误
**A1**: 尝试完全重装phonemizer:
```bash
pip uninstall phonemizer -y
pip install --no-cache-dir phonemizer==3.2.1
```

### Q2: CUDA相关错误
**A2**: 检查CUDA环境变量:
```bash
export PATH=/usr/local/cuda-12.2/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/cuda-12.2/lib64:$LD_LIBRARY_PATH
python3 -c "import torch; print(torch.cuda.is_available())"
```

### Q3: Kokoro模型下载缓慢
**A3**: 使用国内镜像:
```bash
export HF_ENDPOINT=https://hf-mirror.com
```

### Q4: 内存不足错误
**A4**: 检查系统内存:
```bash
free -h
# 如果内存不足，可以添加swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 性能验证

修复完成后，TTS系统应该：
1. ✅ 能够成功导入所有必需模块
2. ✅ 生成真实的人声音频（不是beeping声）
3. ✅ GPU加速正常工作（Tesla P40）
4. ✅ 音频质量清晰自然
5. ✅ 响应时间：CPU模式3-8秒，GPU模式1-2秒

## 联系支持
如果上述方案都无法解决问题，请提供：
1. 完整的错误日志
2. `python3 scripts/debug-kokoro-remote.py` 的输出
3. 系统环境信息：`uname -a && python3 --version`