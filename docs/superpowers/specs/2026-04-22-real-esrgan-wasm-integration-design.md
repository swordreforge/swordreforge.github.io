# Real-ESRGAN 2x 图像超分 WASM 集成设计

**日期**: 2026-04-22  
**项目**: wasm-test  
**主题**: 将 RealSR APK 中的 AI 超分模型集成到 photon-wasm 图像处理器

## 1. 项目概述

从 RealSR APK (RealSR放大图片_1.12.0) 中提取 Real-ESRGAN 2x 超分模型，通过 TensorFlow.js WebGL 在浏览器中运行，实现图像 2x 放大功能，集成到现有的 photon-wasm WASM 图像处理器中。

### 背景

- **现有系统**: photon-wasm (Rust/WASM 图像处理库)
- **目标 APK**: RealSR放大图片_1.12.0 (开源 Android 超分应用)
- **技术需求**: 在浏览器中实现 AI 图像超分辨率放大

## 2. 技术方案

### 2.1 模型转换路径

```
Real-ESRGANv2-anime/x2 (.param + .bin)
    ↓ ncnn2onnx 工具转换
ONNX 模型 (.onnx)
    ↓ tfjs-converter 转换
TensorFlow.js WebGL 模型
    ↓ 集成到前端
photon-wasm 应用
```

### 2.2 源模型信息

| 属性 | 值 |
|------|-----|
| 模型名称 | models-Real-ESRGANv2-anime/x2 |
| 模型格式 | ncnn (.param + .bin) |
| 模型大小 | 1.2MB (x2.bin) + 3.1KB (x2.param) |
| 放大倍数 | 2x |
| 网络架构 | 约 34 层 Conv2D + PReLU + PixelShuffle |

### 2.3 模型架构分析

```
输入 (H x W x 3)
    ↓ Split
分支1:Conv→PReLU→Conv→PReLU→...×17次→Conv→PixelShuffle(2x)
分支2:Interp(2x双线性插值)
    ↓ Add
输出 (2H x 2W x 3)
```

关键算子：
- Convolution (3x3, 64 channels)
- PReLU (Parametric ReLU)
- PixelShuffle (2x upsampling)
- Interp (双线性插值上采样)
- Add (残差连接)

### 2.4 技术栈

| 组件 | 技术选择 |
|------|----------|
| 模型格式转换 | ncnn2onnx + @tensorflow/tfjs-converter |
| WebGL 运行时 | TensorFlow.js WebGL backend |
| 前端框架 | 原生 JavaScript + HTML5 Canvas |
| 现有库 | photon-wasm (Rust/WASM) |

## 3. 功能规格

### 3.1 核心功能

1. **图像 2x 超分放大**
   - 输入: 最大 1024x1024 图片
   - 输出: 2048x2048 图片
   - 处理时间: ≤30 秒

2. **模型加载**
   - 离线加载 TensorFlow.js 模型
   - 模型缓存机制

3. **UI 集成**
   - 在现有 photon-wasm UI 中添加超分功能入口
   - 进度显示

### 3.2 用户流程

```
用户上传图片 → 选择"2x超分"功能 
    → 显示处理进度 
    → AI 模型处理 
    → 显示结果 → 用户保存
```

## 4. 性能规格

### 4.1 性能目标

| 指标 | 目标值 |
|------|--------|
| 输入图片最大尺寸 | 1024x1024 |
| 输出图片尺寸 | 2048x2048 |
| 处理时间 | ≤30 秒 |
| 内存占用 | ≤500MB |
| 浏览器支持 | Chrome/Edge (桌面) |

### 4.2 优化策略

- 使用 TensorFlow.js WebGL 后端
- 模型分块处理 (tiling) 处理大图
- 结果缓存

## 5. 配置文件

### 5.1 依赖项

```json
{
  "@tensorflow/tfjs": "^4.x",
  "@tensorflow/tfjs-converter": "^4.x",
  "@tensorflow/tfjs-backend-webgl": "^4.x"
}
```

### 5.2 项目路径

- **源模型**: `RealSR放大图片_1.12.0/assets/realsr/models-Real-ESRGANv2-anime/x2.{param,bin}`
- **转换后 ONNX**: `models/real_esrgan_x2.onnx`
- **TFJS 模型**: `models/real_esrgan_x2_webgl/`
- **前端代码**: `ai-super-resolution.js`

## 6. 风险与限制

### 6.1 可能的风险

1. **ONNX 算子兼容性问题**
   - ncnn 特有算子可能无法直接转 ONNX
   - 解决方案：手动适配或使用算子映射

2. **WebGL 内存限制**
   - 大图片可能超出 GPU 内存
   - 解决方案：分块处理 (tiling)

3. **转换工具缺失**
   - ncnn2onnx 工具链可能不完整
   - 解决方案：自建转换流程或手动转换

### 6.2 已知限制

- 仅支持 Chrome/Edge 桌面浏览器
- 处理时间可能因硬件配置而异
- 需要 WebGL 2.0 支持

## 7. 后续步骤

1. 环境搭建：安装 ncnn2onnx 和 tfjs 工具
2. 模型转换：测试 ncnn → ONNX 转换
3. ONNX → TFJS 转换
4. 前端集成：开发 AI 超分模块
5. 测试与优化

---

**设计完成**: 2026-04-22  
**状态**: 待用户审批后进入实施阶段