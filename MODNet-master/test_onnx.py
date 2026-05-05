"""
验证 MODNet ONNX 模型是否正常工作
"""

import cv2
import numpy as np
from PIL import Image
import onnxruntime
import os

# ================== 配置 ==================
MODEL_PATH = "pretrained/modnet_photographic_portrait_matting.onnx"
# 测试图片路径（如果有图片可以指定，否则用随机图片测试）
TEST_IMAGE_PATH = None  # 替换为实际图片路径，如 "test.jpg"
OUTPUT_PATH = "test_output.png"
REF_SIZE = 512


def get_scale_factor(im_h, im_w, ref_size):
    if max(im_h, im_w) < ref_size or min(im_h, im_w) > ref_size:
        if im_w >= im_h:
            im_rh = ref_size
            im_rw = int(im_w / im_h * ref_size)
        elif im_w < im_h:
            im_rw = ref_size
            im_rh = int(im_h / im_w * ref_size)
    else:
        im_rh = im_h
        im_rw = im_w

    im_rw = im_rw - im_rw % 32
    im_rh = im_rh - im_rh % 32

    x_scale_factor = im_rw / im_w
    y_scale_factor = im_rh / im_h

    return x_scale_factor, y_scale_factor


def preprocess_image(image_path):
    """读取并预处理图片"""
    im = cv2.imread(image_path)
    if im is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
    
    # 统一通道数为 3
    if len(im.shape) == 2:
        im = im[:, :, None]
    if im.shape[2] == 1:
        im = np.repeat(im, 3, axis=2)
    elif im.shape[2] == 4:
        im = im[:, :, 0:3]
    
    # 归一化到 [-1, 1]
    im = (im - 127.5) / 127.5
    
    im_h, im_w, im_c = im.shape
    x, y = get_scale_factor(im_h, im_w, REF_SIZE)
    
    # 缩放
    im = cv2.resize(im, None, fx=x, fy=y, interpolation=cv2.INTER_AREA)
    
    # 转换为 CHW 格式
    im = np.transpose(im)
    im = np.swapaxes(im, 1, 2)
    im = np.expand_dims(im, axis=0).astype('float32')
    
    return im, im_h, im_w


def run_inference(model_path, input_tensor):
    """运行 ONNX 推理"""
    print(f"加载模型: {model_path}")
    session = onnxruntime.InferenceSession(model_path, None)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    print(f"输入名称: {input_name}, 形状: {session.get_inputs()[0].shape}")
    print(f"输出名称: {output_name}, 形状: {session.get_outputs()[0].shape}")
    print(f"输入张量形状: {input_tensor.shape}")
    
    print("运行推理...")
    result = session.run([output_name], {input_name: input_tensor})
    
    return result[0]


def save_matte(matte, orig_h, orig_w, output_path):
    """保存抠图结果"""
    matte = (np.squeeze(matte) * 255).astype('uint8')
    matte = cv2.resize(matte, dsize=(orig_w, orig_h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(output_path, matte)
    print(f"已保存 matte 到: {output_path}")
    
    # 统计 matte 信息
    print(f"Matte 值范围: {matte.min()} ~ {matte.max()}")
    print(f"Matte 平均值: {matte.mean():.1f}")
    print(f"透明像素 (0): {(matte == 0).sum()}")
    print(f"不透明像素 (255): {(matte == 255).sum()}")
    print(f"半透明像素 (1-254): {((matte > 0) & (matte < 255)).sum()}")


def create_dummy_image():
    """创建一个测试用的虚拟图片（带一个模拟人物）"""
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    # 画一个简单的人形轮廓
    # 头部
    cv2.circle(img, (256, 120), 50, (200, 180, 160), -1)
    # 身体
    cv2.rectangle(img, (200, 170), (312, 350), (50, 80, 120), -1)
    # 手臂
    cv2.rectangle(img, (140, 180), (200, 280), (50, 80, 120), -1)
    cv2.rectangle(img, (312, 180), (372, 280), (50, 80, 120), -1)
    # 腿
    cv2.rectangle(img, (200, 350), (250, 480), (40, 60, 100), -1)
    cv2.rectangle(img, (262, 350), (312, 480), (40, 60, 100), -1)
    
    cv2.imwrite("dummy_test.png", img)
    print("已创建虚拟测试图片: dummy_test.png")
    return "dummy_test.png"


def main():
    print("=" * 50)
    print("MODNet ONNX 模型验证")
    print("=" * 50)
    
    # 检查模型文件
    if not os.path.exists(MODEL_PATH):
        print(f"❌ 找不到模型文件: {MODEL_PATH}")
        return
    else:
        print(f"✅ 找到模型文件: {MODEL_PATH}")
        print(f"   文件大小: {os.path.getsize(MODEL_PATH) / 1024 / 1024:.1f} MB")
    
    # 获取测试图片
    if TEST_IMAGE_PATH and os.path.exists(TEST_IMAGE_PATH):
        image_path = TEST_IMAGE_PATH
        print(f"✅ 使用指定测试图片: {image_path}")
    else:
        print("⚠️  未指定测试图片，创建虚拟测试图片...")
        image_path = create_dummy_image()
    
    # 预处理
    print("\n预处理图片...")
    input_tensor, orig_h, orig_w = preprocess_image(image_path)
    print(f"✅ 预处理完成，原始尺寸: {orig_w}x{orig_h}")
    
    # 推理
    print("\n推理中...")
    result = run_inference(MODEL_PATH, input_tensor)
    
    # 保存结果
    print("\n保存结果...")
    save_matte(result, orig_h, orig_w, OUTPUT_PATH)
    
    print("\n" + "=" * 50)
    print("✅ 验证完成！模型工作正常")
    print("=" * 50)


if __name__ == '__main__':
    main()
