# NCNN增强模块 - 快速开始

## 5分钟快速体验

### 1. 构建模块

```bash
# 确保已安装Emscripten
source /path/to/emsdk/emsdk_env.sh

# 编译
cd ncnn-enhance
./build.sh
```

### 2. 使用简单功能 (无需AI模型)

在您的HTML中添加:

```html
<script type="module">
  import createModule from './pkg/ncnn_enhance.js';

  const Module = await createModule();

  // 获取Canvas图像数据
  const canvas = document.getElementById('myCanvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = new Uint8Array(imageData.data.buffer);

  // 简单锐化
  const resultPtr = Module.sharpen_image_simple(
    data.byteOffset,
    canvas.width,
    canvas.height,
    1.0  // 锐化强度
  );

  // 获取并显示结果
  const resultData = new Uint8Array(
    Module.HEAP8.buffer,
    resultPtr,
    canvas.width * canvas.height * 4
  );

  const resultImageData = new ImageData(
    new Uint8ClampedArray(resultData),
    canvas.width,
    canvas.height
  );
  ctx.putImageData(resultImageData, 0, 0);

  // 释放内存
  Module.free_image_data(resultPtr);
</script>
```

### 3. 运行示例

```bash
# 启动本地服务器
cd ..
python3 -m http.server 3000

# 浏览器打开
open http://localhost:3000/ncnn-enhance/example.html
```

### 4. 测试其他功能

- **去噪**: 调用 `Module.denoise_image_simple()`
- **颜色转换**: `Module.rgba_to_rgb()`, `Module.rgb_to_rgba()`

## 下一步

- 查看 `BUILD.md` 了解详细构建说明
- 查看 `example.html` 学习完整用法
- 准备ncnn模型使用AI增强功能

## 常见问题

**Q: 为什么AI增强按钮是禁用的？**
A: AI增强需要先加载ncnn模型文件。目前示例仅展示简单算法，您需要准备模型文件后调用 `init_enhance_net()`。

**Q: 处理大图会卡顿吗？**
A: 建议在Web Worker中运行处理函数，或在主线程使用 `requestAnimationFrame` 分块处理。

**Q: 内存如何管理？**
A: 必须调用 `free_image_data()` 和 `free_enhance_result()` 释放返回的指针，否则会内存泄漏。