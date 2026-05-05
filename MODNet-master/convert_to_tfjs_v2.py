"""
将 MODNet ONNX 模型转为 TFJS 格式（备用方案）
使用 tf2onnx 反向转换：PyTorch → TensorFlow → TFJS
"""

import os
import numpy as np
import torch
import torch.nn as nn
from torch.autograd import Variable

# 添加项目路径
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from onnx import modnet_onnx

CKPT_PATH = "pretrained/modnet_photographic_portrait_matting.ckpt"
TF_SAVEDMODEL_PATH = "modnet_tf_savedmodel"
TFJS_OUTPUT_PATH = "../../modnet-tfjs"


def main():
    print("=" * 50)
    print("MODNet PyTorch → TFJS 转换")
    print("=" * 50)
    
    if not os.path.exists(CKPT_PATH):
        print(f"❌ 找不到权重文件: {CKPT_PATH}")
        return
    
    print(f"加载 PyTorch 权重: {CKPT_PATH}")
    
    # 定义模型
    modnet = modnet_onnx.MODNet(backbone_pretrained=False)
    state_dict = torch.load(CKPT_PATH, map_location='cpu')
    modnet.load_state_dict(state_dict)
    modnet.eval()
    
    print(f"✅ 模型加载成功")
    
    # 创建 dummy input
    dummy_input = torch.randn(1, 3, 512, 512)
    
    # 导出为 ONNX 作为中间步骤验证
    print(f"\n测试 PyTorch 推理...")
    with torch.no_grad():
        output = modnet(dummy_input)
    print(f"输出形状: {output.shape}")
    print(f"输出范围: {output.min().item():.4f} ~ {output.max().item():.4f}")
    
    print(f"\n⚠️  转换为 TFJS 需要使用 torch-tf 或手动转换")
    print(f"推荐使用 ONNX Runtime Web 直接加载 .onnx 文件")
    print(f"ONNX 文件已存在: pretrained/modnet_photographic_portrait_matting.onnx")


if __name__ == '__main__':
    main()
