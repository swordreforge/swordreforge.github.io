# Real-ESRGAN 2x WASM 集成实施计划

**目标:** 将 Real-ESRGAN 2x 超分模型从 ncnn 格式转换为 TensorFlow.js WebGL，集成到 photon-wasm 图像处理器

**架构:** ncnn (.param+.bin) → ONNX → TensorFlow.js WebGL → 前端 AI 超分模块

**技术栈:** ncnn2onnx, @tensorflow/tfjs, photon-wasm, 原生 JavaScript

---

### Task 1: 环境搭建 - 安装模型转换工具

**Files:**
- Modify: `package.json`
- Create: `scripts/install-conversion-tools.sh`

- [ ] **Step 1: 添加 TensorFlow.js 依赖**

```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-converter @tensorflow/tfjs-backend-webgl --save
```

- [ ] **Step 2: 检查 ncnn2onnx 工具**

检查系统是否有 ncnn2onnx 或检查项目中是否有可用的转换脚本：

```bash
which ncnn2onnx || ls ncnn-20260113-webassembly/
```

如果不存在，需要创建替代方案（见 Task 2）。

- [ ] **Step 3: 提交更改**

```bash
git add package.json
git commit -m "chore: add tfjs dependencies for super-resolution"
```

---

### Task 2: 模型转换 - ncnn → ONNX

**Files:**
- Create: `scripts/ncnn_to_onnx.py` (Python 脚本)
- Create: `models/real_esrgan_x2.onnx`

- [ ] **Step 1: 创建 ncnn 到 ONNX 的转换脚本**

由于设计文档提到需要 ncnn2onnx 工具，但该工具可能不在项目中，创建一个 Python 脚本使用 onnx 与 ncnn 的映射：

```python
# scripts/ncnn_to_onnx.py
#!/usr/bin/env python3
"""
将 ncnn 模型转换为 ONNX 格式
使用现有的 .param 文件解析并重建为 ONNX 图
"""
import numpy as np
import onnx
from onnx import helper, TensorProto

# 模型架构分析 (从 x2.param):
# - Input: data (H x W x 3)
# - Split: 分支处理
# - 17层 Conv(3x3,64) + PReLU
# - Conv(64→12) + PixelShuffle(2x)
# - Interp(2x 双线性) + Add → output

def create_esrgan_onnx():
    # 创建输入
    input_tensor = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, -1, -1])
    
    # 创建输出
    output_tensor = helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, -1, -1])
    
    # 注意：由于架构复杂，此脚本需要根据实际 param 文件构建
    # 这是一个占位符，实际转换需要手动构建
    pass

if __name__ == '__main__':
    print("需要手动实现 ncnn 到 ONNX 的转换")
```

**注意:** 由于 ncnn 模型无法直接用简单脚本转换，需要手动构建或使用现有工具。

- [ ] **Step 2: 探索替代转换方案**

搜索可用的转换工具：

```bash
# 检查是否有 python ncnn 库
pip list | grep ncnn || echo "ncnn not installed"
```

- [ ] **Step 3: 记录转换状态**

由于 ncnn→ONNX 转换复杂，此步骤标记为需要进一步研究。

- [ ] **Step 4: 提交更改**

```bash
git add scripts/ncnn_to_onnx.py
git commit -m "chore: add ncnn to onnx conversion script"
```

---

### Task 3: 模型转换 - ONNX → TensorFlow.js

**Files:**
- Create: `models/real_esrgan_x2_webgl/`
- Modify: `scripts/convert_onnx_tfjs.sh`

- [ ] **Step 1: 创建 TFJS 转换脚本**

```bash
# scripts/convert_onnx_tfjs.sh
#!/bin/bash
# 将 ONNX 模型转换为 TensorFlow.js WebGL 格式

MODEL_DIR="models/real_esrgan_x2_webgl"

tensorflowjs_converter \
    --input_format=onnx \
    --output_format=tfjs_graph_model \
    --quantization_bytes=2 \
    models/real_esrgan_x2.onnx \
    $MODEL_DIR

echo "Model converted to $MODEL_DIR"
```

- [ ] **Step 2: 测试转换（假设 ONNX 模型已存在）**

```bash
bash scripts/convert_onnx_tfjs.sh
```

- [ ] **Step 3: 验证模型文件**

```bash
ls -la models/real_esrgan_x2_webgl/
```

- [ ] **Step 4: 提交更改**

```bash
git add models/ real_esrgan_x2_webgl/
git commit -m "feat: add tfjs super-resolution model"
```

---

### Task 4: 前端集成 - AI 超分模块

**Files:**
- Create: `ai-super-resolution.js`
- Modify: `ai-functions.js`

- [ ] **Step 1: 创建 AI 超分模块**

```javascript
// ai-super-resolution.js
import * as tf from '@tensorflow/tfjs';

class SuperResolution {
    constructor() {
        this.model = null;
        this.modelUrl = 'models/real_esrgan_x2_webgl/model.json';
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;
        this.model = await tf.loadGraphModel(this.modelUrl);
        this.loaded = true;
    }

    async process(imageData, scale = 2) {
        await this.load();
        
        const tensor = tf.browser.fromPixels(imageData);
        const expanded = tensor.expandDims(0);
        const normalized = expanded.div(255.0);
        
        const result = this.model.predict(normalized);
        const output = result.squeeze().mul(255.0);
        
        return await tf.browser.toPixels(output);
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
            this.loaded = false;
        }
    }
}

export default SuperResolution;
```

- [ ] **Step 2: 添加到 ai-functions.js**

```javascript
{
    name: "super_resolution_2x",
    description: "AI 2x 超分放大 (使用 Real-ESRGAN)",
    parameters: {
        type: "object",
        properties: {
            model: { type: "string", description: "超分模型类型", enum: ["esrgan-anime"] }
        },
        required: ["model"]
    }
}
```

- [ ] **Step 3: 测试加载**

```bash
# 启动本地服务器测试
npx serve .
```

- [ ] **Step 4: 提交更改**

```bash
git add ai-super-resolution.js ai-functions.js
git commit -m "feat: add AI super-resolution module"
```

---

### Task 5: UI 集成与测试

**Files:**
- Modify: `index.html`
- Create: `test-super-resolution.html`

- [ ] **Step 1: 在 index.html 添加超分功能入口**

在图像处理选项中添加 "2x 超分" 按钮。

- [ ] **Step 2: 创建测试页面**

```html
<!-- test-super-resolution.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Super Resolution Test</title>
</head>
<body>
    <input type="file" id="upload">
    <button id="process">2x 超分</button>
    <canvas id="output"></canvas>
    <script type="module">
        import SuperResolution from './ai-super-resolution.js';
        const sr = new SuperResolution();
        // 测试代码
    </script>
</body>
</html>
```

- [ ] **Step 3: 手动测试流程**

1. 上传 512x512 图片
2. 点击 "2x 超分"
3. 验证输出 1024x1024 图片
4. 检查处理时间 ≤30 秒

- [ ] **Step 4: 提交更改**

```bash
git add index.html test-super-resolution.html
git commit -m "test: add super-resolution UI and tests"
```

---

### Task 6: 性能优化

**Files:**
- Modify: `ai-super-resolution.js`

- [ ] **Step 1: 添加分块处理 (tiling)**

当图片大于 512x512 时，使用分块处理避免 WebGL 内存不足。

- [ ] **Step 2: 添加进度回调**

```javascript
async process(imageData, onProgress) {
    // onProgress(percent): 报告处理进度
}
```

- [ ] **Step 3: 性能测试**

测试不同尺寸图片的处理时间。

- [ ] **Step 4: 提交更改**

```bash
git commit -m "perf: add tiling and progress reporting"
```

---

**执行选项:**

1. **Subagent-Driven (推荐)** - 每个任务分配给子代理
2. **Inline Execution** - 在当前会话中批量执行

请选择执行方式。