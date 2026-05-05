"""
量化 MODNet ONNX 模型
方案：
1. FP16 量化 (~13MB) - 质量几乎无损，ONNX Runtime Web 支持
2. INT8 动态量化 (~6MB) - 有轻微质量损失，推理更快
"""

import os
import numpy as np
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

MODEL_PATH = "pretrained/modnet_photographic_portrait_matting.onnx"
OUTPUT_DIR = "quantized"


def quantize_fp16():
    """FP16 量化：体积减半，质量几乎无损"""
    print("\n" + "=" * 50)
    print("FP16 量化中...")
    print("=" * 50)
    
    from onnxmltools import utils
    
    output_path = os.path.join(OUTPUT_DIR, "modnet_fp16.onnx")
    
    try:
        from onnxconverter_common import float16
        model = onnx.load(MODEL_PATH)
        model_fp16 = float16.convert_float_to_float16(model)
        onnx.save(model_fp16, output_path)
        
        orig_size = os.path.getsize(MODEL_PATH)
        new_size = os.path.getsize(output_path)
        
        print(f"✅ FP16 量化完成!")
        print(f"   原始大小: {orig_size / 1024 / 1024:.1f} MB")
        print(f"   量化大小: {new_size / 1024 / 1024:.1f} MB")
        print(f"   压缩率: {(1 - new_size/orig_size) * 100:.1f}%")
        print(f"   输出路径: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ FP16 量化失败: {e}")
        print(f"   尝试安装: pip install onnxconverter-common")
        return False


def quantize_int8():
    """INT8 动态量化：体积最小，速度最快"""
    print("\n" + "=" * 50)
    print("INT8 动态量化中...")
    print("=" * 50)
    
    output_path = os.path.join(OUTPUT_DIR, "modnet_int8.onnx")
    
    try:
        # 动态量化（不需要校准数据）
        quantize_dynamic(
            model_input=MODEL_PATH,
            model_output=output_path,
            per_channel=False,
            reduce_range=False,
            weight_type=QuantType.QUInt8,
        )
        
        orig_size = os.path.getsize(MODEL_PATH)
        new_size = os.path.getsize(output_path)
        
        print(f"✅ INT8 量化完成!")
        print(f"   原始大小: {orig_size / 1024 / 1024:.1f} MB")
        print(f"   量化大小: {new_size / 1024 / 1024:.1f} MB")
        print(f"   压缩率: {(1 - new_size/orig_size) * 100:.1f}%")
        print(f"   输出路径: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ INT8 量化失败: {e}")
        return False


def main():
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 找不到模型: {MODEL_PATH}")
        return
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 尝试 FP16 量化
    fp16_ok = quantize_fp16()
    
    # 尝试 INT8 量化
    int8_ok = quantize_int8()
    
    print("\n" + "=" * 50)
    print("量化总结")
    print("=" * 50)
    print(f"原始模型: {os.path.getsize(MODEL_PATH) / 1024 / 1024:.1f} MB")
    
    if fp16_ok:
        print(f"FP16 模型: {os.path.getsize(os.path.join(OUTPUT_DIR, 'modnet_fp16.onnx')) / 1024 / 1024:.1f} MB")
    
    if int8_ok:
        print(f"INT8 模型: {os.path.getsize(os.path.join(OUTPUT_DIR, 'modnet_int8.onnx')) / 1024 / 1024:.1f} MB")
    
    # 验证量化后的模型
    print("\n验证量化模型...")
    import onnxruntime as ort
    
    for name in ["modnet_fp16.onnx", "modnet_int8.onnx"]:
        path = os.path.join(OUTPUT_DIR, name)
        if os.path.exists(path):
            try:
                session = ort.InferenceSession(path, None)
                dummy = np.random.randn(1, 3, 256, 256).astype(np.float32)
                result = session.run(None, {"input": dummy})
                print(f"✅ {name}: 推理正常，输出范围 {result[0].min():.4f} ~ {result[0].max():.4f}")
            except Exception as e:
                print(f"❌ {name}: {e}")


if __name__ == '__main__':
    main()
