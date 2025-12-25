#!/usr/bin/env python3
"""
Kokoro TTS CoreML 导出脚本 - 基于 kokoro-coreml 项目方法
强制导出到 CoreML，支持 Apple Neural Engine 加速

参考: https://github.com/mattmireles/kokoro-coreml
"""

import os
import sys
import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'kokoro_local'))

import torch
import torch.nn as nn
import numpy as np
import warnings

# 抑制警告
warnings.filterwarnings('ignore')

# 修补 Kokoro 的 rsqrt 问题
def patch_kokoro_rsqrt():
    """
    修补 Kokoro istftnet 中的 rsqrt(torch.tensor(2)) 问题
    将 int32 tensor 改为 float32
    """
    import kokoro.istftnet as istftnet
    
    # 预计算常量
    RSQRT_2 = torch.rsqrt(torch.tensor(2.0, dtype=torch.float32))
    
    # 保存原始的 forward 方法
    original_forward = istftnet.AdainResBlk1d.forward
    
    def patched_forward(self, x, s):
        out = self._residual(x, s)
        out = (out + self._shortcut(x)) * RSQRT_2
        return out
    
    # 替换方法
    istftnet.AdainResBlk1d.forward = patched_forward
    print("✅ 已修补 Kokoro rsqrt 问题")

# 在导入 kokoro 之前修补
patch_kokoro_rsqrt()


def check_dependencies():
    """检查必要依赖"""
    try:
        import coremltools as ct
        print(f"✅ coremltools {ct.__version__}")
    except ImportError:
        print("❌ coremltools 未安装")
        sys.exit(1)
    
    try:
        from kokoro import KModel
        print(f"✅ kokoro KModel 可用")
    except ImportError:
        print("❌ kokoro 未安装或 KModel 不可用")
        sys.exit(1)
    
    return ct


class GeneratorNoSource(nn.Module):
    """
    Generator 变体，接受预计算的 harmonic source 特征
    避免 CoreML 不支持的复杂操作
    """
    def __init__(self, generator):
        super().__init__()
        self.num_kernels = generator.num_kernels
        self.num_upsamples = generator.num_upsamples
        self.noise_convs = generator.noise_convs
        self.noise_res = generator.noise_res
        self.ups = generator.ups
        self.resblocks = generator.resblocks
        self.post_n_fft = generator.post_n_fft
        self.conv_post = generator.conv_post
        self.reflection_pad = generator.reflection_pad
        
    def forward(self, x, s, har):
        """
        x: [batch, 512, time]
        s: [batch, 128]
        har: [batch, n_fft+2, time] - 预计算的 harmonic 特征
        """
        for i in range(self.num_upsamples):
            x = torch.nn.functional.leaky_relu(x, negative_slope=0.1)
            x_source = self.noise_convs[i](har)
            x_source = self.noise_res[i](x_source, s)
            x = self.ups[i](x)
            if i == self.num_upsamples - 1:
                x = self.reflection_pad(x)
            x = x + x_source
            xs = None
            for j in range(self.num_kernels):
                if xs is None:
                    xs = self.resblocks[i * self.num_kernels + j](x, s)
                else:
                    xs += self.resblocks[i * self.num_kernels + j](x, s)
            x = xs / self.num_kernels
        
        x = torch.nn.functional.leaky_relu(x)
        x = self.conv_post(x)
        return x


class DecoderNoSourceWrapper(nn.Module):
    """
    Decoder 包装器，接受预计算的 hn-nsf harmonic source 特征
    CoreML 端不生成 source，只消费它
    """
    def __init__(self, decoder):
        super().__init__()
        self.decoder = decoder
        self.gen_no_source = GeneratorNoSource(decoder.generator)
        
    def forward(self, asr_4d, f0_curve_4d, n_4d, s, har_spec_4d, har_phase_4d):
        # 从 4D 转换回期望的形状
        asr = asr_4d.squeeze(2)  # (B, 512, T_asr)
        f0_curve = f0_curve_4d.squeeze(2).squeeze(1)  # (B, T)
        n = n_4d.squeeze(2).squeeze(1)  # (B, T)
        
        # 预处理 F0 和 N
        F0 = self.decoder.F0_conv(f0_curve.unsqueeze(1))
        N = self.decoder.N_conv(n.unsqueeze(1))
        
        x = torch.cat([asr, F0, N], axis=1)
        x = self.decoder.encode(x, s)
        
        asr_res = self.decoder.asr_res(asr)
        
        res = True
        for block in self.decoder.decode:
            if res:
                x = torch.cat([x, asr_res, F0, N], axis=1)
            x = block(x, s)
            if getattr(block, 'upsample_type', 'none') != 'none':
                res = False
        
        # 构建 har
        har_spec = har_spec_4d.squeeze(2)
        har_phase = har_phase_4d.squeeze(2)
        har = torch.cat([har_spec, har_phase], dim=1)
        
        # 运行 generator
        x = self.gen_no_source(x, s, har)
        
        return x


def compute_har_shapes(decoder, f0_len: int):
    """计算给定 f0 长度的 har 形状"""
    with torch.no_grad():
        gen = decoder.generator
        device = next(gen.parameters()).device
        
        f0 = torch.zeros((1, f0_len), dtype=torch.float32, device=device)
        f0_up = gen.f0_upsamp(f0[:, None]).transpose(1, 2)
        har_source, _, _ = gen.m_source(f0_up)
        har_source = har_source.transpose(1, 2).squeeze(1)
        har_spec, har_phase = gen.stft.transform(har_source)
        
        har_c = har_spec.shape[1]
        har_t = har_spec.shape[2]
        
        return har_c, har_t


def export_decoder_har_bucket(decoder, seconds: int, output_dir: Path, ct):
    """
    导出指定时长的 Decoder HAR bucket
    """
    print(f"\n📦 导出 Decoder HAR bucket: {seconds}s")
    
    wrapper = DecoderNoSourceWrapper(decoder).eval().cpu()
    
    # 计算时间维度
    f0_per_sec = 80  # 24kHz / 300 samples per f0 frame
    f0_len = int(seconds * f0_per_sec)
    asr_len = f0_len // 2
    
    # 计算 har 形状
    har_c, har_t = compute_har_shapes(decoder, f0_len)
    
    print(f"  f0_len={f0_len}, asr_len={asr_len}, har_c={har_c}, har_t={har_t}")
    
    # 创建示例输入
    sample_inputs = (
        torch.zeros(1, 512, 1, asr_len, dtype=torch.float32),
        torch.zeros(1, 1, 1, f0_len, dtype=torch.float32),
        torch.zeros(1, 1, 1, f0_len, dtype=torch.float32),
        torch.zeros(1, 128, dtype=torch.float32),
        torch.zeros(1, har_c, 1, har_t, dtype=torch.float32),
        torch.zeros(1, har_c, 1, har_t, dtype=torch.float32),
    )
    
    # Trace
    print("  Tracing...")
    with torch.no_grad():
        traced = torch.jit.trace(wrapper, sample_inputs, strict=False)
    
    # 转换到 CoreML - 使用 CPU_AND_GPU 避免 ANE 编译延迟
    print("  Converting to CoreML...")
    ml = ct.convert(
        traced,
        inputs=[
            ct.TensorType(name="asr", shape=(1, 512, 1, asr_len), dtype=np.float32),
            ct.TensorType(name="f0_curve", shape=(1, 1, 1, f0_len), dtype=np.float32),
            ct.TensorType(name="n", shape=(1, 1, 1, f0_len), dtype=np.float32),
            ct.TensorType(name="s", shape=(1, 128), dtype=np.float32),
            ct.TensorType(name="har_spec", shape=(1, har_c, 1, har_t), dtype=np.float32),
            ct.TensorType(name="har_phase", shape=(1, har_c, 1, har_t), dtype=np.float32),
        ],
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.macOS13,
        compute_precision=ct.precision.FLOAT16,
        compute_units=ct.ComputeUnit.CPU_AND_GPU,  # 使用 GPU 而不是 ANE，避免编译延迟
    )
    
    # 保存
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"KokoroDecoder_HAR_{seconds}s.mlpackage"
    ml.save(str(out_path))
    print(f"  ✅ 保存: {out_path}")
    
    return out_path


def export_full_pipeline(output_dir: Path, ct, buckets: list):
    """导出完整的 Kokoro CoreML 模型"""
    print("\n🚀 开始导出 Kokoro CoreML 模型...")
    
    # 使用 disable_complex=True 避免复杂操作
    print("📥 加载 Kokoro 模型 (disable_complex=True)...")
    from kokoro import KModel
    model = KModel(disable_complex=True).to('cpu').eval()
    print("✅ 模型加载成功")
    
    decoder = model.decoder
    
    # 导出各个 bucket
    exported = {}
    for seconds in buckets:
        try:
            path = export_decoder_har_bucket(decoder, seconds, output_dir, ct)
            exported[f"decoder_{seconds}s"] = True
        except Exception as e:
            print(f"  ❌ {seconds}s bucket 导出失败: {e}")
            import traceback
            traceback.print_exc()
            exported[f"decoder_{seconds}s"] = False
    
    # 保存配置
    import json
    config = {
        "model_version": "kokoro-82m-coreml",
        "sample_rate": 24000,
        "export_status": exported,
        "compute_units": "ALL",
        "precision": "FLOAT16",
        "buckets": {f"{s}s": {"f0_len": s * 80, "asr_len": s * 40} for s in buckets},
    }
    
    config_path = output_dir / "config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"\n✅ 配置文件: {config_path}")
    
    return config


def main():
    parser = argparse.ArgumentParser(description='导出 Kokoro TTS 到 CoreML')
    parser.add_argument('--output_dir', type=str, default='kokoro_local/coreml')
    parser.add_argument('--buckets', type=str, default='3,10,30',
                        help='Bucket 秒数，逗号分隔')
    args = parser.parse_args()
    
    output_dir = PROJECT_ROOT / args.output_dir
    buckets = [int(x) for x in args.buckets.split(',')]
    
    print("=" * 60)
    print("🍎 Kokoro TTS CoreML 导出工具 (强制 CoreML)")
    print("=" * 60)
    print(f"输出目录: {output_dir}")
    print(f"Buckets: {buckets}s")
    
    ct = check_dependencies()
    
    try:
        config = export_full_pipeline(output_dir, ct, buckets)
        
        print("\n" + "=" * 60)
        print("导出状态:")
        success_count = 0
        for component, status in config.get('export_status', {}).items():
            icon = "✅" if status else "❌"
            print(f"  {icon} {component}")
            if status:
                success_count += 1
        
        total = len(config['export_status'])
        if success_count == 0:
            print("\n❌ 所有模型导出失败!")
            sys.exit(1)
        elif success_count < total:
            print(f"\n⚠️ 部分模型导出成功 ({success_count}/{total})")
        else:
            print(f"\n✅ 所有模型导出成功!")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 导出失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
