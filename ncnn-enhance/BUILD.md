# NCNN 增强模块 - 构建指南

## 快速开始

### 前置条件

1. **Emscripten SDK** - 用于编译C++代码到WebAssembly
2. **ncnn库** - 已包含在 `../ncnn-20260113-webassembly/basic/` 目录

### 安装Emscripten

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install 3.1.28
./emsdk activate 3.1.28
source emsdk_env.sh
```

### 构建步骤

#### 方法1: 使用构建脚本 (推荐)

```bash
cd ncnn-enhance
chmod +x build.sh
./build.sh
```

#### 方法2: 手动编译

```bash
cd ncnn-enhance
em++ \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="NcnnEnhance" \
  -s ENVIRONMENT=web \
  -s NO_EXIT_RUNTIME=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","setValue","getValue","UTF8ToString","stringToUTF8"]' \
  --bind \
  -I../ncnn-20260113-webassembly/basic/include \
  -L../ncnn-20260113-webassembly/basic/lib \
  -lncnn \
  -O3 \
  -std=c++17 \
  ncnn_enhance.cpp \
  -o ../pkg/ncnn_enhance.js
```

### 输出文件

编译成功后，以下文件会生成在 `../pkg/` 目录：

- `ncnn_enhance.js` (约 42KB) - JavaScript绑定文件
- `ncnn_enhance.wasm` (约 1.1MB) - WebAssembly模块

## 使用方法

### 基本用法

```javascript
import createModule from './pkg/ncnn_enhance.js';

// 初始化模块
const Module = await createModule();

// 检查网络是否已加载
const isLoaded = Module.is_net_loaded();
console.log('Network loaded:', isLoaded);
```

### 简单锐化 (不需要AI模型)

```javascript
// 获取图像数据
const imageData = ctx.getImageData(0, 0, width, height);
const data = new Uint8Array(imageData.data.buffer);

// 调用锐化函数
const resultPtr = Module.sharpen_image_simple(
    data.byteOffset,
    width,
    height,
    1.0  // 锐化强度 0.0-2.0
);

// 获取结果
const resultData = new Uint8Array(
    Module.HEAP8.buffer,
    resultPtr,
    width * height * 4
);

// 使用结果
const resultImageData = new ImageData(
    new Uint8ClampedArray(resultData),
    width,
    height
);
ctx.putImageData(resultImageData, 0, 0);

// 释放内存
Module.free_image_data(resultPtr);
```

### 简单去噪 (不需要AI模型)

```javascript
// 调用去噪函数
const resultPtr = Module.denoise_image_simple(
    data.byteOffset,
    width,
    height,
    3  // 滤波核大小 (3, 5, 7等奇数)
);

// 使用和释放方式同锐化
```

### AI增强 (需要加载ncnn模型)

```javascript
// 1. 准备模型文件（二进制格式）
const modelParam = new Uint8Array(paramFileData);
const modelBin = new Uint8Array(binFileData);

// 2. 分配内存并复制模型数据
const paramPtr = Module._malloc(modelParam.length);
const binPtr = Module._malloc(modelBin.length);
Module.HEAPU8.set(modelParam, paramPtr);
Module.HEAPU8.set(modelBin, binPtr);

// 3. 初始化网络
const result = Module.init_enhance_net(
    paramPtr,
    modelParam.length,
    binPtr,
    modelBin.length
);

if (result === 0) {
    console.log('网络初始化成功');

    // 4. 执行AI增强
    const enhanceResult = Module.enhance_image(
        data.byteOffset,
        width,
        height,
        0  // 增强类型: 0=通用, 1=去噪, 2=超分辨率, 3=锐化
    );

    if (enhanceResult.success) {
        // 5. 获取结果
        const resultData = new Uint8Array(
            Module.HEAP8.buffer,
            enhanceResult.data,
            enhanceResult.width * enhanceResult.height * enhanceResult.channels
        );

        // 使用结果...
        Module.free_enhance_result(enhanceResult);
    }
}

// 6. 释放模型内存
Module._free(paramPtr);
Module._free(binPtr);
```

## API参考

### 初始化函数

#### `init_enhance_net(model_param, param_size, model_bin, bin_size)`
初始化AI网络

- **参数**:
  - `model_param`: `uint8_t*` - 模型参数数据指针
  - `param_size`: `int` - 参数数据大小
  - `model_bin`: `uint8_t*` - 模型权重数据指针
  - `bin_size`: `int` - 权重数据大小
- **返回值**: `int` - 0=成功, 负数=错误码

#### `is_net_loaded()`
检查网络是否已加载

- **返回值**: `bool`

### 图像处理函数

#### `enhance_image(input_data, width, height, enhance_type)`
AI图像增强

- **参数**:
  - `input_data`: `uint8_t*` - RGBA格式图像数据指针
  - `width`: `int` - 图像宽度
  - `height`: `int` - 图像高度
  - `enhance_type`: `int` - 增强类型
- **返回值**: `EnhanceResult*` - 增强结果结构指针

#### `sharpen_image_simple(input_data, width, height, strength)`
简单锐化

- **参数**:
  - `input_data`: `uint8_t*` - RGBA格式图像数据指针
  - `width`: `int` - 图像宽度
  - `height`: `int` - 图像高度
  - `strength`: `float` - 锐化强度 (0.0-2.0)
- **返回值**: `uint8_t*` - 处理后的图像数据指针

#### `denoise_image_simple(input_data, width, height, kernel_size)`
简单去噪

- **参数**:
  - `input_data`: `uint8_t*` - RGBA格式图像数据指针
  - `width`: `int` - 图像宽度
  - `height`: `int` - 图像高度
  - `kernel_size`: `int` - 滤波核大小 (3, 5, 7等奇数)
- **返回值**: `uint8_t*` - 处理后的图像数据指针

### 内存管理函数

#### `free_image_data(data)`
释放图像数据内存

- **参数**:
  - `data`: `uint8_t*` - 图像数据指针

#### `free_enhance_result(result)`
释放增强结果内存

- **参数**:
  - `result`: `EnhanceResult*` - 增强结果指针

## 模型准备

### 转换PyTorch模型到ncnn格式

```bash
# 1. 使用pnnx导出模型
pnnx your_model.py

# 2. 生成的文件:
# - your_model.ncnn.param (模型结构)
# - your_model.ncnn.bin (模型权重)
```

### 加载模型到WebAssembly

由于WebAssembly环境限制，需要将模型文件转换为二进制数组：

```javascript
async function loadModel(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

// 使用
const modelParam = await loadModel('model.param');
const modelBin = await loadModel('model.bin');
```

## 性能优化建议

1. **Web Worker**: 在Worker中运行图像处理以避免阻塞UI
2. **图像分块**: 大图像可以分块处理
3. **内存预分配**: 预先分配足够的WASM内存
4. **模型优化**: 使用量化或剪枝减小模型大小

## 故障排除

### 编译错误

**问题**: 找不到ncnn库
```bash
# 解决: 检查库路径是否正确
ls ../ncnn-20260113-webassembly/basic/lib/libncnn.a
```

**问题**: Emscripten版本不兼容
```bash
# 解决: 使用指定版本的Emscripten
./emsdk install 3.1.28
./emsdk activate 3.1.28
```

### 运行时错误

**问题**: 模块加载失败
```
检查:
1. COI headers 是否正确设置 (coi-serviceworker.min.js)
2. Wasm MIME 类型是否正确
3. 浏览器是否支持 WebAssembly
```

**问题**: 内存不足
```javascript
// 解决: 增加内存限制
-s ALLOW_MEMORY_GROWTH=1
-s INITIAL_MEMORY=67108864  // 64MB
```

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Opera 76+

需要启用WebAssembly支持。

## 示例

查看 `example.html` 获取完整的使用示例。

## 许可证

基于ncnn的BSD-3-Clause许可证。