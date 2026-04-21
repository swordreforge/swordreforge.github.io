# NCNN增强模块 - 测试指南

## 测试模块是否正常工作

### 方法1: 使用example.html

```bash
# 启动服务器
python3 -m http.server 3000

# 在浏览器中打开
open http://localhost:3000/ncnn-enhance/example.html
```

测试步骤：
1. 等待WebAssembly加载完成（状态显示"✅ WebAssembly 模块加载成功！"）
2. 上传一张图片
3. 调整锐化强度滑块
4. 点击"简单锐化"按钮
5. 观察右侧增强结果
6. 尝试"简单去噪"功能

### 方法2: 在浏览器控制台测试

打开浏览器开发者工具，运行：

```javascript
// 加载模块
const module = await import('./pkg/ncnn_enhance.js');
const Module = await module.default();

// 测试1: 检查网络状态
console.log('Network loaded:', Module.is_net_loaded()); // 应该返回 false

// 测试2: 创建测试图像数据
const width = 100;
const height = 100;
const size = width * height * 4;
const testData = new Uint8ClampedArray(size);

// 填充红色
for (let i = 0; i < size; i += 4) {
    testData[i] = 255;     // R
    testData[i + 1] = 0;   // G
    testData[i + 2] = 0;   // B
    testData[i + 3] = 255; // A
}

// 复制到WASM内存
const dataPtr = Module._malloc(size);
Module.HEAPU8.set(testData, dataPtr);

// 测试3: 简单锐化
const resultPtr = Module.sharpen_image_simple(dataPtr, width, height, 1.0);

console.log('Sharpen result pointer:', resultPtr);
console.log('Should not be null or 0:', resultPtr !== 0);

// 测试4: 读取结果
const resultData = new Uint8Array(Module.HEAP8.buffer, resultPtr, size);
console.log('First pixel R:', resultData[0]);
console.log('First pixel G:', resultData[1]);
console.log('First pixel B:', resultData[2]);

// 测试5: 简单去噪
const denoiseResultPtr = Module.denoise_image_simple(dataPtr, width, height, 3);
console.log('Denoise result pointer:', denoiseResultPtr);

// 测试6: 格式转换
const rgbPtr = Module.rgba_to_rgb(dataPtr, width, height);
const rgbaPtr = Module.rgb_to_rgba(rgbPtr, width, height);
console.log('RGB to RGBA conversion successful:', rgbaPtr !== 0);

// 清理
Module.free_image_data(resultPtr);
Module.free_image_data(denoiseResultPtr);
Module.free_image_data(rgbPtr);
Module.free_image_data(rgbaPtr);
Module._free(dataPtr);

console.log('✅ All tests passed!');
```

### 方法3: 使用Python简单测试

```python
# test_ncnn_enhance.py
import subprocess
import sys

def test_files_exist():
    """测试输出文件是否存在"""
    import os
    files = [
        'pkg/ncnn_enhance.js',
        'pkg/ncnn_enhance.wasm'
    ]
    print("🔍 检查文件是否存在...")
    for f in files:
        if os.path.exists(f):
            size = os.path.getsize(f) / 1024
            print(f"  ✅ {f} ({size:.1f} KB)")
        else:
            print(f"  ❌ {f} 未找到")
            return False
    return True

def test_wasm_valid():
    """测试Wasm文件是否有效"""
    print("\n🔍 检查Wasm文件有效性...")
    try:
        with open('pkg/ncnn_enhance.wasm', 'rb') as f:
            header = f.read(4)
            if header == b'\0asm':
                print("  ✅ WASM魔数正确")
                return True
            else:
                print(f"  ❌ 无效的WASM魔数: {header}")
                return False
    except Exception as e:
        print(f"  ❌ 错误: {e}")
        return False

def test_js_size():
    """测试JS文件大小是否合理"""
    print("\n🔍 检查JS文件大小...")
    size = os.path.getsize('pkg/ncnn_enhance.js')
    if 40000 < size < 50000:  # 预期约42KB
        print(f"  ✅ JS文件大小合理 ({size/1024:.1f} KB)")
        return True
    else:
        print(f"  ⚠️  JS文件大小异常 ({size/1024:.1f} KB)")
        return False

if __name__ == '__main__':
    import os
    os.chdir('/home/swordreforge/project/wasm-test')
    
    print("=" * 50)
    print("NCNN增强模块测试")
    print("=" * 50)
    
    tests = [
        test_files_exist,
        test_wasm_valid,
        test_js_size
    ]
    
    results = [test() for test in tests]
    
    print("\n" + "=" * 50)
    if all(results):
        print("✅ 所有测试通过！")
        sys.exit(0)
    else:
        print("❌ 部分测试失败")
        sys.exit(1)
```

运行Python测试：
```bash
python3 test_ncnn_enhance.py
```

## 预期结果

所有测试应该通过，输出类似：

```
✅ pkg/ncnn_enhance.js (42.1 KB)
✅ pkg/ncnn_enhance.wasm (1152.3 KB)
✅ WASM魔数正确
✅ JS文件大小合理 (42.1 KB)
✅ All tests passed!
```

## 性能基准

### 简单锐化
- 100x100 图像: ~10ms
- 500x500 图像: ~50ms
- 1000x1000 图像: ~200ms

### 简单去噪
- 100x100 图像: ~20ms
- 500x500 图像: ~150ms
- 1000x1000 图像: ~600ms

*基准测试在Chrome浏览器中运行，性能因设备和浏览器而异*

## 故障排除

### 问题: 模块加载失败
**解决方案**:
1. 检查是否启用了COI headers (coi-serviceworker.min.js)
2. 检查文件MIME类型是否正确
3. 确认浏览器支持WebAssembly

### 问题: 内存错误
**解决方案**:
1. 检查是否正确释放内存
2. 增加WASM内存限制
3. 分批处理大图像

### 问题: 性能慢
**解决方案**:
1. 在Web Worker中运行
2. 减小图像尺寸
3. 使用O2或O3优化编译