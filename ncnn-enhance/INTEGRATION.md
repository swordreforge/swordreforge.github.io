# 集成到主项目指南

本文档说明如何将ncnn增强模块集成到 `index.html` 主项目中。

## 📦 已生成的文件

在 `pkg/` 目录下已生成：
- `ncnn_enhance.js` (42KB) - JavaScript模块
- `ncnn_enhance.wasm` (1.1MB) - WebAssembly二进制

## 🔧 集成步骤

### 步骤1: 在index.html中导入模块

在 `<script type="module">` 部分添加：

```javascript
// 导入ncnn增强模块
import createNcnnModule from './pkg/ncnn_enhance.js';

// 在全局变量中存储模块引用
let ncnnModule = null;
```

### 步骤2: 初始化模块

在 `loadWasmModule()` 函数中添加：

```javascript
async function loadWasmModule() {
    // ... 现有的photon-wasm加载代码 ...

    // 加载ncnn增强模块
    try {
        ncnnModule = await createNcnnModule();
        console.log('✅ NCNN增强模块加载成功');
    } catch (error) {
        console.error('❌ NCNN增强模块加载失败:', error);
    }

    return {
        // ... 现有返回值 ...
    };
}
```

### 步骤3: 在侧边栏添加UI控件

在HTML的侧边栏中添加新的功能区域：

```html
<div class="section">
    <h3>🎨 AI 图像增强</h3>

    <div class="slider-container">
        <label for="sharpnessStrength">锐化强度</label>
        <input type="range" id="sharpnessStrength" min="0" max="2" step="0.1" value="1">
        <div class="slider-value" id="sharpnessValue">1.0</div>
    </div>

    <div class="slider-container">
        <label for="denoiseKernel">去噪核大小</label>
        <input type="range" id="denoiseKernel" min="3" max="7" step="2" value="3">
        <div class="slider-value" id="denoiseKernelValue">3</div>
    </div>

    <div class="btn-group">
        <button id="sharpenBtn" class="btn btn-success" disabled>🔍 简单锐化</button>
        <button id="denoiseBtn" class="btn btn-success" disabled>🎯 简单去噪</button>
    </div>

    <div class="info-panel">
        <p>💡 简单算法无需AI模型，速度较快</p>
    </div>
</div>
```

### 步骤4: 添加事件监听器

在JavaScript中添加按钮事件处理：

```javascript
// 锐化按钮
document.getElementById('sharpenBtn').addEventListener('click', async function() {
    if (!ncnnModule || !currentImageData) {
        alert('请先加载图像');
        return;
    }

    const strength = parseFloat(document.getElementById('sharpnessStrength').value);

    showLoading(true, '正在锐化图像...');

    try {
        // 获取图像数据
        const canvas = document.getElementById('imageCanvas');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = new Uint8Array(imageData.data.buffer);

        // 调用锐化函数
        const resultPtr = ncnnModule.sharpen_image_simple(
            data.byteOffset,
            canvas.width,
            canvas.height,
            strength
        );

        // 获取结果
        const resultData = new Uint8Array(
            ncnnModule.HEAP8.buffer,
            resultPtr,
            canvas.width * canvas.height * 4
        );

        // 显示结果
        const resultImageData = new ImageData(
            new Uint8ClampedArray(resultData),
            canvas.width,
            canvas.height
        );
        ctx.putImageData(resultImageData, 0, 0);

        // 保存到历史记录
        saveToHistory();

        // 释放内存
        ncnnModule.free_image_data(resultPtr);

        showLoading(false);
        console.log('✅ 锐化完成');
    } catch (error) {
        showLoading(false);
        console.error('❌ 锐化失败:', error);
        alert('锐化失败: ' + error.message);
    }
});

// 去噪按钮
document.getElementById('denoiseBtn').addEventListener('click', async function() {
    if (!ncnnModule || !currentImageData) {
        alert('请先加载图像');
        return;
    }

    const kernelSize = parseInt(document.getElementById('denoiseKernel').value);

    showLoading(true, '正在去噪...');

    try {
        const canvas = document.getElementById('imageCanvas');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = new Uint8Array(imageData.data.buffer);

        const resultPtr = ncnnModule.denoise_image_simple(
            data.byteOffset,
            canvas.width,
            canvas.height,
            kernelSize
        );

        const resultData = new Uint8Array(
            ncnnModule.HEAP8.buffer,
            resultPtr,
            canvas.width * canvas.height * 4
        );

        const resultImageData = new ImageData(
            new Uint8ClampedArray(resultData),
            canvas.width,
            canvas.height
        );
        ctx.putImageData(resultImageData, 0, 0);

        saveToHistory();
        ncnnModule.free_image_data(resultPtr);

        showLoading(false);
        console.log('✅ 去噪完成');
    } catch (error) {
        showLoading(false);
        console.error('❌ 去噪失败:', error);
        alert('去噪失败: ' + error.message);
    }
});

// 滑块值更新
document.getElementById('sharpnessStrength').addEventListener('input', function() {
    document.getElementById('sharpnessValue').textContent = parseFloat(this.value).toFixed(1);
});

document.getElementById('denoiseKernel').addEventListener('input', function() {
    document.getElementById('denoiseKernelValue').textContent = this.value;
});
```

### 步骤5: 启用按钮

在图像加载成功后启用按钮：

```javascript
// 在loadImage函数中，图像加载成功后添加
if (ncnnModule) {
    document.getElementById('sharpenBtn').disabled = false;
    document.getElementById('denoiseBtn').disabled = false;
}
```

### 步骤6: 添加CSS样式（可选）

在 `<style>` 部分添加：

```css
/* AI增强区域样式 */
#sharpnessStrength, #denoiseKernel {
    width: 100%;
}
```

## 🎯 完整集成示例

查看 `ncnn-enhance/example.html` 获取完整的集成示例代码。

## 📋 集成检查清单

- [ ] 在 `pkg/` 目录确认 `ncnn_enhance.js` 和 `ncnn_enhance.wasm` 存在
- [ ] 在 `index.html` 中导入模块
- [ ] 在 `loadWasmModule()` 中初始化模块
- [ ] 添加UI控件（滑块和按钮）
- [ ] 添加事件监听器
- [ ] 图像加载后启用按钮
- [ ] 测试锐化功能
- [ ] 测试去噪功能
- [ ] 测试内存释放
- [ ] 测试撤销/重做功能

## 🚀 高级功能：AI增强

如果需要使用AI增强功能，需要额外加载ncnn模型：

```javascript
// 加载模型文件
async function loadNcnnModel(paramUrl, binUrl) {
    try {
        const [paramResponse, binResponse] = await Promise.all([
            fetch(paramUrl),
            fetch(binUrl)
        ]);

        const paramData = new Uint8Array(await paramResponse.arrayBuffer());
        const binData = new Uint8Array(await binResponse.arrayBuffer());

        // 分配内存
        const paramPtr = ncnnModule._malloc(paramData.length);
        const binPtr = ncnnModule._malloc(binData.length);
        ncnnModule.HEAPU8.set(paramData, paramPtr);
        ncnnModule.HEAPU8.set(binData, binPtr);

        // 初始化网络
        const result = ncnnModule.init_enhance_net(
            paramPtr,
            paramData.length,
            binPtr,
            binData.length
        );

        if (result === 0) {
            console.log('✅ AI网络初始化成功');
            return true;
        } else {
            console.error('❌ AI网络初始化失败，错误码:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ 加载模型失败:', error);
        return false;
    }
}

// 使用AI增强
async function aiEnhanceImage() {
    if (!ncnnModule.is_net_loaded()) {
        alert('请先加载AI模型');
        return;
    }

    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = new Uint8Array(imageData.data.buffer);

    const result = ncnnModule.enhance_image(
        data.byteOffset,
        canvas.width,
        canvas.height,
        0  // 增强类型
    );

    if (result.success) {
        const resultData = new Uint8Array(
            ncnnModule.HEAP8.buffer,
            result.data,
            result.width * result.height * result.channels
        );

        const resultImageData = new ImageData(
            new Uint8ClampedArray(resultData),
            result.width,
            result.height
        );

        canvas.width = result.width;
        canvas.height = result.height;
        ctx.putImageData(resultImageData, 0, 0);

        ncnnModule.free_enhance_result(result);
    } else {
        alert('AI增强失败: ' + result.error);
    }
}
```

## ⚠️ 注意事项

1. **内存管理**: 必须调用 `free_image_data()` 和 `free_enhance_result()` 释放内存
2. **错误处理**: 检查函数返回值，处理可能的错误
3. **性能**: 大图像处理可能较慢，建议显示加载状态
4. **兼容性**: 确保COI headers正确设置
5. **模型大小**: AI模型文件较大，需要优化加载策略

## 📊 性能建议

1. **Web Worker**: 在Worker中运行图像处理
2. **图像缩放**: 处理大图时先缩放到合理尺寸
3. **进度显示**: 显示处理进度
4. **取消支持**: 允许用户取消长时间操作

## 🔍 测试建议

1. 测试不同尺寸的图像
2. 测试不同的参数值
3. 测试内存泄漏（多次操作）
4. 测试错误情况（无图像、模块未加载等）
5. 测试撤销/重做功能

## 📞 获取帮助

如果遇到集成问题：
1. 查看 `ncnn-enhance/example.html` 示例
2. 查看 `ncnn-enhance/BUILD.md` 构建指南
3. 检查浏览器控制台的错误信息
4. 确认COI headers正确设置

## ✅ 集成完成标志

集成成功的标志：
- ✅ 模块加载成功（控制台显示）
- ✅ 图像加载后按钮可用
- ✅ 锐化功能正常工作
- ✅ 去噪功能正常工作
- ✅ 内存正确释放
- ✅ 撤销/重做功能正常
- ✅ 无控制台错误

祝集成顺利！🎉