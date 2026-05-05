"""
将 MODNet ONNX 模型转为 TFJS 格式
流程: ONNX → TensorFlow SavedModel → TFJS
"""

import os
import numpy as np

# 需要安装: pip install onnx2tf onnx tensorflow tensorflowjs
import onnx
import onnx2tf
import tensorflow as tf

MODEL_PATH = "pretrained/modnet_photographic_portrait_matting.onnx"
TF_SAVEDMODEL_PATH = "modnet_tf_savedmodel"
TFJS_OUTPUT_PATH = "../../modnet-tfjs"


def main():
    print("=" * 50)
    print("MODNet ONNX → TFJS 转换")
    print("=" * 50)
    
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 找不到模型: {MODEL_PATH}")
        return
    
    print(f"加载 ONNX 模型: {MODEL_PATH}")
    onnx_model = onnx.load(MODEL_PATH)
    print(f"✅ ONNX 模型加载成功")
    print(f"   输入: {[i.name for i in onnx_model.graph.input]}")
    print(f"   输出: {[o.name for o in onnx_model.graph.output]}")
    
    print(f"\n转换为 TensorFlow SavedModel...")
    print(f"输出路径: {TF_SAVEDMODEL_PATH}")
    
    # 使用 onnx2tf 转换
    onnx2tf.convert(
        input_onnx_file_path=MODEL_PATH,
        output_folder_path=TF_SAVEDMODEL_PATH,
        verbose_mode=True,
    )
    
    print(f"\n✅ SavedModel 转换完成")
    
    # 转换为 TFJS 格式
    print(f"\n转换为 TFJS 格式...")
    print(f"输出路径: {TFJS_OUTPUT_PATH}")
    
    os.system(f"tensorflowjs_converter "
              f"--input_format=tf_saved_model "
              f"--output_format=tfjs_graph_model "
              f"--signature_name=serving_default "
              f"{TF_SAVEDMODEL_PATH} "
              f"{TFJS_OUTPUT_PATH}")
    
    print(f"\n✅ TFJS 转换完成！")
    print(f"输出目录: {TFJS_OUTPUT_PATH}")
    
    # 列出输出文件
    if os.path.exists(TFJS_OUTPUT_PATH):
        files = os.listdir(TFJS_OUTPUT_PATH)
        print(f"生成的文件: {files}")


if __name__ == '__main__':
    main()
