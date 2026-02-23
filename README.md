# Photon WASM - WebAssembly 图像处理器

一个基于 Rust 和 WebAssembly 的强大图像处理库，在浏览器中实现高性能的图像编辑功能。

## 项目概述

本项目是对 [photon-rs](https://github.com/silvia-odwyer/photon) 的 WebAssembly 封装，提供丰富的图像处理功能，包括滤镜、特效、文本绘制、水印添加等。所有处理都在浏览器本地完成，无需服务器端支持。

## 核心特性

### 🎨 图像滤镜
- **基础滤镜**：灰度、复古、反色、二值化
- **预设滤镜**：23种预设滤镜（oceanic、lofi、vintage、dramatic 等）
- **参数调节**：亮度、对比度、饱和度、色相、明度、伽马校正

### ✨ 特殊效果
- 像素化、半色调、油画、曝光、抖动
- 双色效果、主色效果、着色效果
- 毛玻璃效果、条纹效果（水平/垂直）

### 🔧 图像变换
- 旋转（90° 或任意角度）
- 水平/垂直翻转
- 裁剪、缩放

### 📝 文本绘制
- 支持多种中文字体
- 文字颜色自定义
- 阴影效果支持

### 🏷️ 水印功能
- 图片水印添加
- 支持15种混合模式
- 水印缩放、旋转、透明度控制

### 🎯 高级功能
- 模糊效果（高斯模糊、盒式模糊）
- 边缘检测（Sobel、Prewitt 等）
- 卷积效果（浮雕、拉普拉斯等）
- 通道操作（RGB 通道调整、交换）
- 色彩空间转换（HSL、HSV、LCh）

## 技术栈

- **后端**：Rust + photon-rs
- **编译工具**：wasm-pack
- **优化工具**：wasm-opt (Oz 优化)
- **前端**：原生 JavaScript + HTML5 Canvas

## 项目结构

```
wasm-test/
├── photon-wasm/          # Rust WebAssembly 源码
│   ├── src/lib.rs        # 主要导出函数
│   └── pkg/              # 编译输出
├── pkg/                  # 最终 WASM 包
│   ├── photon_wasm.js
│   ├── photon_wasm_bg.wasm
│   └── *.d.ts           # TypeScript 类型定义
├── index.html           # 演示页面
└── text-test.html       # 文本功能测试页面
```

## 快速开始

### 1. 安装依赖

确保已安装 Rust 和 wasm-pack：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack
```

### 2. 编译 WASM

```bash
cd photon-wasm
wasm-pack build --target web --out-dir pkg
```

### 3. 优化 WASM（可选）

使用 wasm-opt 进一步减小文件大小：

```bash
wasm-opt -Oz -o photon_wasm_bg_opt.wasm photon_wasm_bg.wasm
```

### 4. 使用示例

```html
<script type="module">
  import init, { ImageProcessor } from './pkg/photon_wasm.js';

  async function processImage() {
    await init();
    
    // 从文件加载图像
    const response = await fetch('image.jpg');
    const bytes = await response.arrayBuffer();
    
    // 创建处理器
    const processor = new ImageProcessor(new Uint8Array(bytes));
    
    // 应用滤镜
    processor.apply_grayscale();
    processor.apply_brightness(50);
    
    // 获取处理后的图像
    const base64 = processor.to_base64();
    document.getElementById('result').src = 'data:image/jpeg;base64,' + base64;
  }
  
  processImage();
</script>
```

## API 文档

### 基础操作

| 方法 | 参数 | 说明 |
|------|------|------|
| `new_from_bytes(bytes)` | `Uint8Array` | 从字节数组创建图像 |
| `to_base64()` | - | 转换为 base64 字符串 |
| `get_width()` | - | 获取图像宽度 |
| `get_height()` | - | 获取图像高度 |
| `reset()` | - | 重置到原始图像 |

### 滤镜效果

| 方法 | 参数 | 说明 |
|------|------|------|
| `apply_grayscale()` | - | 灰度效果 |
| `apply_sepia()` | - | 复古效果 |
| `apply_invert()` | - | 反色效果 |
| `apply_threshold(threshold)` | `u32` | 二值化 |
| `apply_preset_filter(name)` | `string` | 预设滤镜 |

### 参数调节

| 方法 | 参数 | 范围 | 说明 |
|------|------|------|------|
| `apply_brightness(level)` | `i32` | -255 ~ 255 | 亮度 |
| `apply_contrast(level)` | `f32` | -255 ~ 255 | 对比度 |
| `apply_saturation(level)` | `f32` | -1 ~ 1 | 饱和度 |
| `apply_hue(level)` | `i32` | -360 ~ 360 | 色相 |
| `apply_gamma(r, g, b)` | `f32` | 0.1 ~ 10.0 | 伽马校正 |

### 文本绘制

| 方法 | 参数 | 说明 |
|------|------|------|
| `draw_text_with_font(text, x, y, size, font_type)` | `string, i32, i32, f32, u8` | 绘制文本 |
| `draw_text_with_shadow_and_font(text, x, y, size, font_type)` | `string, i32, i32, f32, u8` | 带阴影文本 |
| `draw_text_with_color_and_font(text, x, y, size, r, g, b, font_type)` | `string, i32, i32, f32, u8, u8, u8, u8` | 彩色文本 |

字体类型：0-丁卯点阵体，1-Roboto常规，2-中宫黑体

### 水印功能

| 方法 | 参数 | 说明 |
|------|------|------|
| `apply_watermark(bytes, x, y)` | `Uint8Array, i64, i64` | 简单水印 |
| `apply_watermark_with_blend(bytes, x, y, scale, mode)` | `Uint8Array, i64, i64, f32, string` | 带混合模式水印 |
| `apply_watermark_advanced(bytes, x, y, scale, mode, opacity, rotation)` | `Uint8Array, i64, i64, f32, string, f32, f32` | 高级水印 |

混合模式：overlay、multiply、screen、soft_light、hard_light、difference 等 15 种

## 性能优化

- 使用 `wasm-opt -Oz` 进行体积优化
- 字体系统简化为三种核心字体
- 批量应用调节避免重复重置
- 高效的图像处理算法

## 浏览器兼容性

- Chrome/Edge 57+
- Firefox 52+
- Safari 11+
- 支持 WebAssembly 的所有现代浏览器

## 开发说明

### 编译命令

```bash
# 开发模式编译
cd photon-wasm
wasm-pack build --dev --target web --out-dir pkg

# 生产模式编译（优化）
wasm-pack build --release --target web --out-dir pkg

# 复制到主目录
cp pkg/photon_wasm_bg.wasm ../pkg/
cp pkg/photon_wasm.js ../pkg/
cp pkg/photon_wasm.d.ts ../pkg/
cp pkg/photon_wasm_bg.wasm.d.ts ../pkg/
```

### 添加新功能

1. 在 `photon-wasm/src/lib.rs` 中添加新的 Rust 函数
2. 使用 `#[wasm_bindgen]` 宏导出函数
3. 重新编译 WASM 模块
4. 更新前端 JavaScript 调用代码

## 许可证

本项目基于 Apache 2.0 许可证开源。

- photon-rs: [Apache 2.0](https://github.com/silvia-odwyer/photon/blob/master/LICENSE.md)
- Roboto 字体: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- 丁卯点阵体: [OFL-1.1](https://scripts.sil.org/OFL)
- 中宫黑体: [个人授权]

## 相关文档

- [功能检查报告](./功能检查报告.md) - 详细的功能清单
- [水印功能开发文档](./水印功能开发文档.md) - 水印功能实现说明
- [字体支持开发文档](./字体支持开发文档.md) - 字体系统说明
- [官方demo功能实现参考](./官方demo功能实现参考.md) - 官方 demo 参考

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [photon-rs](https://github.com/silvia-odwyer/photon) - 图像处理核心库
- [Rust WebAssembly](https://rustwasm.github.io/) - Rust WebAssembly 工作组
- 所有贡献者