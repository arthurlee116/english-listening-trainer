#!/usr/bin/env python3
"""
Kokoro TTS Self-Test CLI
自检命令行工具，用于验证 TTS 功能和性能
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML not installed. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def load_config(config_path: str) -> Dict[str, Any]:
    """加载 YAML 配置文件"""
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    return config


def setup_environment(config: Dict[str, Any]) -> None:
    """根据配置设置环境变量"""
    # 设置设备
    if 'device' in config:
        os.environ['KOKORO_DEVICE'] = config['device']

    # 设置模型路径（如果配置中指定）
    if config.get('model_path_env') and config.get('model_path_env') in os.environ:
        # 环境变量已经设置，保持不变
        pass

    # 启用详细输出
    if config.get('enable_verbose', False):
        os.environ['KOKORO_VERBOSE'] = '1'


async def run_synthesis_test(config: Dict[str, Any], skip_on_missing: bool = False) -> Dict[str, Any]:
    """运行合成测试"""
    from kokoro_wrapper import KokoroTTSWrapper
    from text_chunker import split_text_intelligently, MAX_CHUNK_CHAR_SIZE

    # 准备输出目录
    output_dir = Path(config.get('output_dir', '/tmp/kokoro-selftest'))
    output_dir.mkdir(parents=True, exist_ok=True)

    # 初始化 wrapper
    wrapper = KokoroTTSWrapper(
        lang_code=config.get('lang_code', 'a'),
        voice=config.get('voice', 'af_heart')
    )

    # 开始计时
    start_time = time.time()

    try:
        # 初始化模型
        await wrapper.initialize()

        # 获取测试文本
        test_text = config.get('test_text', 'Hello, this is a test.')
        speed = config.get('speed', 1.0)

        # 分块预览
        chunks = split_text_intelligently(test_text, MAX_CHUNK_CHAR_SIZE)
        chunk_count = len(chunks)

        # 生成音频
        audio_hex = await wrapper.generate_speech(test_text, speed)

        # 结束计时
        synthesis_time = time.time() - start_time

        # 保存音频文件
        audio_bytes = bytes.fromhex(audio_hex)
        output_file = output_dir / 'test_output.wav'
        output_file.write_bytes(audio_bytes)

        # 计算音频元数据
        wav_size = len(audio_bytes)

        # 从 WAV 头部提取时长（简化计算）
        # WAV 格式: 44 字节头部 + PCM 数据
        # 采样率 24000 Hz, 16-bit, mono
        sample_rate = 24000
        bits_per_sample = 16
        num_channels = 1
        data_size = wav_size - 44  # 减去 WAV 头部
        duration_seconds = data_size / (sample_rate * num_channels * bits_per_sample // 8)

        # 获取模型路径（尝试从环境变量或默认路径）
        model_path = os.environ.get('KOKORO_LOCAL_MODEL_PATH', 'auto-detected')
        if model_path == 'auto-detected':
            # 尝试找到实际使用的模型路径
            possible_paths = [
                Path('kokoro_local/.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main'),
                Path.home() / '.cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots/main',
                Path('kokoro-models/Kokoro-82M'),
            ]
            for p in possible_paths:
                if p.exists():
                    model_path = str(p)
                    break

        return {
            'status': 'success',
            'timestamp': datetime.now().isoformat(),
            'config_file': config.get('_config_path', 'unknown'),
            'device': wrapper.device or 'unknown',
            'model_path': model_path,
            'chunks': chunk_count,
            'synthesis_time_seconds': round(synthesis_time, 2),
            'audio_duration_seconds': round(duration_seconds, 2),
            'wav_size_bytes': wav_size,
            'output_file': str(output_file),
            'test_text_length': len(test_text),
            'lang_code': wrapper.lang_code,
            'voice': wrapper.voice,
            'speed': speed,
        }

    except FileNotFoundError as e:
        if skip_on_missing:
            return {
                'status': 'skipped',
                'reason': 'model_not_found',
                'message': str(e),
                'timestamp': datetime.now().isoformat(),
            }
        raise

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e),
            'error_type': type(e).__name__,
            'timestamp': datetime.now().isoformat(),
            'synthesis_time_seconds': round(time.time() - start_time, 2),
        }


def format_markdown(result: Dict[str, Any]) -> str:
    """格式化为 Markdown 输出"""
    if result['status'] == 'skipped':
        return f"""# Kokoro TTS Self-Test Report

- **Timestamp**: {result['timestamp']}
- **Status**: ⚠️  SKIPPED
- **Reason**: {result['reason']}

{result['message']}
"""

    if result['status'] == 'error':
        return f"""# Kokoro TTS Self-Test Report

- **Timestamp**: {result['timestamp']}
- **Status**: ❌ ERROR

## Error Details
- **Type**: {result.get('error_type', 'Unknown')}
- **Message**: {result['error']}
- **Time Elapsed**: {result.get('synthesis_time_seconds', 0)}s
"""

    # Success case
    status_emoji = '✅'
    mb_size = result['wav_size_bytes'] / 1024 / 1024

    return f"""# Kokoro TTS Self-Test Report

- **Timestamp**: {result['timestamp']}
- **Config**: {result['config_file']}
- **Device**: {result['device']}
- **Model Path**: {result['model_path']}
- **Status**: {status_emoji} {result['status']}

## Performance
- **Synthesis Time**: {result['synthesis_time_seconds']}s
- **Audio Duration**: {result['audio_duration_seconds']}s
- **Chunks Processed**: {result['chunks']}
- **Real-time Factor**: {result['synthesis_time_seconds'] / result['audio_duration_seconds']:.2f}x

## Output
- **File**: {result['output_file']}
- **Size**: {mb_size:.2f} MB
- **Format**: WAV (24kHz, 16-bit, mono)

## Configuration
- **Language**: {result['lang_code']}
- **Voice**: {result['voice']}
- **Speed**: {result['speed']}
- **Test Text Length**: {result['test_text_length']} chars
"""


def format_json(result: Dict[str, Any]) -> str:
    """格式化为 JSON 输出"""
    return json.dumps(result, indent=2)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='Kokoro TTS Self-Test CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # CPU mode (default Markdown output)
  python -m kokoro_local.selftest --config configs/default.yaml

  # GPU mode with JSON output
  python -m kokoro_local.selftest --config configs/gpu.yaml --format json

  # CI mode (skip if model missing)
  python -m kokoro_local.selftest --config configs/default.yaml --skip-on-missing-model
        """
    )

    parser.add_argument(
        '--config',
        required=True,
        help='Path to YAML configuration file'
    )

    parser.add_argument(
        '--format',
        choices=['markdown', 'json'],
        default='markdown',
        help='Output format (default: markdown)'
    )

    parser.add_argument(
        '--skip-on-missing-model',
        action='store_true',
        help='Exit with code 0 if model not found (for CI)'
    )

    args = parser.parse_args()

    try:
        # 加载配置
        config = load_config(args.config)
        config['_config_path'] = args.config

        # 设置环境
        setup_environment(config)

        # 运行测试
        result = asyncio.run(run_synthesis_test(config, args.skip_on_missing_model))

        # 输出结果
        if args.format == 'markdown':
            print(format_markdown(result))
        else:
            print(format_json(result))

        # 退出码
        if result['status'] == 'success':
            sys.exit(0)
        elif result['status'] == 'skipped' and args.skip_on_missing_model:
            sys.exit(0)
        else:
            sys.exit(1)

    except Exception as e:
        error_result = {
            'status': 'error',
            'error': str(e),
            'error_type': type(e).__name__,
            'timestamp': datetime.now().isoformat(),
        }

        if args.format == 'markdown':
            print(format_markdown(error_result), file=sys.stderr)
        else:
            print(format_json(error_result), file=sys.stderr)

        sys.exit(1)


if __name__ == '__main__':
    main()
