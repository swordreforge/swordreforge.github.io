# NCNN AI 图像增强模块

这是一个基于ncnn的WebAssembly图像增强模块，提供AI驱动的图像修复、去噪、超分辨率等功能。

## 功能特性

- **AI图像增强**: 使用神经网络进行智能图像优化
- **去噪**: 使用AI模型去除图像噪声
- **超分辨率**: 提升图像分辨率
- **锐化**: 增强图像边缘和细节
- **传统算法**: 提供简单的锐化和中值滤波算法

## 目录结构

```
ncnn-enhance/
├── ncnn_enhance.cpp      # C++源代码
├── CMakeLists.txt        # CMake构建配置
├── README.md             # 本文档
├── build.sh              # Linux/macOS构建脚本
└── build.bat             # Windows构建脚本
```

## 依赖项

- Emscripten 3.1.28+
- ncnn WebAssembly库 (位于 `../ncnn-20260113-webassembly/basic/`)
- CMake 3.10+

## 安装Emscripten

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install 3.1.28
./emsdk activate 3.1.28
source emsdk_env.sh
```

## 构建步骤

### Linux/macOS

1. 确保已激活Emscripten环境:
```bash
source /path/to/emsdk/emsdk_env.sh
```

2. 运行构建脚本:
```bash
cd ncnn-enhance
chmod +x build.sh
./build.sh
```

3. 输出文件:
- `../pkg/ncnn_enhance.js` - JavaScript绑定文件
- `../pkg/ncnn_enhance.wasm` - WebAssembly模块

### Windows

1. 激活Emscripten环境:
```cmd
C:\path\to\emsdk\emsdk_env.bat
```

2. 运行构建脚本:
```cmd
cd ncnn-enhance
build.bat
```

## 手动构建

如果构建脚本无法使用，可以手动执行以下命令:

```bash
# 创建构建目录
mkdir -p build
cd build

# 配置CMake
cmake -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    ..

# 编译
cmake --build . -j4

# 输出文件位于 build/ 目录
```

## API使用说明

### 初始化

```javascript
import createModule from './pkg/ncnn_enhance.js';

const Module = await createModule();

// 初始化AI网络 (需要提供模型参数和权重)
const modelParam = "/* .param 文件内容 */";
const modelBin = "/* .bin 文件内容 */";
const result = Module.init_enhance_net(modelParam, modelBin);

if (result === 0) {
    console.log("AI网络初始化成功");
}
```

### 图像增强

```javascript
// 获取图像数据 (RGBA格式)
const imageData = ctx.getImageData(0, 0, width, height);
const dataArray = new Uint8Array(imageData.data.buffer);

// 调用AI增强
const enhanceResult = Module.enhance_image(
    dataArray.byteOffset,  // 图像数据指针
    width,                 // 图像宽度
    height,                // 图像高度
    0                      // 增强类型: 0=通用, 1=去噪, 2=超分辨率, 3=锐化
);

if (enhanceResult.success) {
    // 获取增强后的图像数据
    const outputData = new Uint8Array(
        Module.HEAP8.buffer,
        enhanceResult.data,
        enhanceResult.width * enhanceResult.height * enhanceResult.channels
    );

    // 更新Canvas
    const outputImageData = new ImageData(
        new Uint8ClampedArray(outputData),
        enhanceResult.width,
        enhanceResult.height
    );
    ctx.putImageData(outputImageData, 0, 0);

    // 释放内存
    Module.free_enhance_result(enhanceResult);
} else {
    console.error("增强失败:", enhanceResult.error);
}
```

### 简单锐化 (不需要AI模型)

```javascript
const sharpenedData = Module.sharpen_image_simple(
    dataArray.byteOffset,
    width,
    height,
    1.0  // 锐化强度 (0.0-2.0)
);

// 使用sharpenedData后记得释放
Module.free_image_data(sharpenedData);
```

### 简单去噪 (不需要AI模型)

```javascript
const denoisedData = Module.denoise_image_simple(
    dataArray.byteOffset,
    width,
    height,
    3  // 滤波核大小 (3, 5, 7等奇数)
);

// 使用denoisedData后记得释放
Module.free_image_data(denoisedData);
```

## 增强类型说明

| 类型 | 值 | 说明 |
|------|-----|------|
| 通用增强 | 0 | 使用默认输出节点进行增强 |
| 去噪 | 1 | 使用专门的去噪模型 |
| 超分辨率 | 2 | 提升图像分辨率 |
| 锐化 | 3 | 增强图像细节 |

## 内存管理

所有从C++返回的指针都需要手动释放:

- `free_image_data(uint8_t* data)` - 释放图像数据
- `free_enhance_result(EnhanceResult* result)` - 释放增强结果

## 模型准备

要使用AI增强功能，需要准备ncnn模型:

1. 训练或下载图像增强模型 (如SRGAN, DnCNN等)
2. 使用pnnx工具转换为ncnn格式:
```bash
pnnx model.py
```
3. 将生成的 `.param` 和 `.bin` 文件内容作为字符串传递给 `init_enhance_net()`

## 注意事项

1. **内存限制**: WebAssembly有内存限制，处理大图时可能需要分块处理
2. **性能**: AI推理可能较慢，建议在Web Worker中运行
3. **模型大小**: AI模型文件较大，需要优化加载策略
4. **浏览器兼容性**: 需要支持WebAssembly的现代浏览器

## 故障排除

### 编译错误

如果遇到ncnn相关的编译错误，检查:
- ncnn库路径是否正确
- Emscripten版本是否兼容
- CMake配置是否正确

### 运行时错误

如果遇到运行时错误:
- 检查模型文件是否正确加载
- 确认图像格式为RGBA
- 查看浏览器控制台的错误信息

## 许可证

本项目基于ncnn的BSD-3-Clause许可证。

## 参考资料

- [ncnn官方文档](https://github.com/Tencent/ncnn)
- [Emscripten文档](https://emscripten.org/)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)