# WASM 并行化功能说明

## 当前状态

WASM模块已成功使用 `wasm-bindgen-rayon` 构建并启用了并行化支持，但由于环境限制，当前运行在**单线程模式**。

## 技术背景

`wasm-bindgen-rayon` 使用 `SharedArrayBuffer` 在主线程和Web Workers之间共享内存，以实现高效的并行图像处理。

## 错误原因

当前遇到 `DataCloneError` 是因为：
- Web Workers无法通过 `postMessage` 克隆 `Memory` 对象
- 这通常是因为缺少必要的HTTP安全头部

## 启用并行化的条件

要启用并行化，服务器必须发送以下两个HTTP响应头：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### 为什么需要这些头部？

这些头部是为了安全地启用 `SharedArrayBuffer`，防止Spectre等侧信道攻击。

## 各平台配置方法

### 1. 本地开发服务器

使用支持自定义头部的服务器：

#### 使用 http-server (Node.js)
```bash
npx http-server . -p 8080 --cors --header "Cross-Origin-Opener-Policy:same-origin" --header "Cross-Origin-Embedder-Policy:require-corp"
```

#### 使用 Python http.server
```bash
python3 -m http.server 8080 --bind 127.0.0.1
```
需要额外配置头部，建议使用其他服务器。

#### 使用 Vite
```javascript
// vite.config.js
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
}
```

### 2. GitHub Pages

**GitHub Pages 目前不支持自定义HTTP头部**，因此无法在GitHub Pages上启用 `SharedArrayBuffer` 和并行化。

### 3. Nginx
```nginx
location / {
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
}
```

### 4. Apache
```apache
<IfModule mod_headers.c>
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>
```

### 5. Netlify
```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

### 6. Vercel
```javascript
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

## 代码实现

### 自动检测和降级

代码已经实现了自动检测和降级：

```javascript
// 检测SharedArrayBuffer支持
const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';

if (hasSharedArrayBuffer) {
    try {
        const numThreads = navigator.hardwareConcurrency || 4;
        await initThreadPool(numThreads);
        console.log(`✓ Parallelization enabled with ${numThreads} threads`);
    } catch (error) {
        console.warn('⚠ Falling back to single-threaded mode');
    }
}
```

### 手动启用

如果你在支持的环境下，可以手动调用：

```javascript
import init, { initThreadPool } from './pkg/photon_wasm.js';

await init();

// 初始化线程池（推荐使用硬件并发数）
await initThreadPool(navigator.hardwareConcurrency || 4);
```

## 性能对比

| 模式 | 线程数 | 适用场景 | 性能 |
|------|--------|----------|------|
| 单线程 | 1 | 所有环境（GitHub Pages） | 基准 |
| 并行化 | 4-16 | 支持SharedArrayBuffer的环境 | 2-4x提升 |

## 注意事项

1. **安全性**：启用这些头部可能会影响某些跨域资源加载
2. **兼容性**：需要现代浏览器支持（Chrome 92+, Firefox 89+, Safari 15.2+）
3. **调试**：使用浏览器开发者工具的Network标签检查响应头

## 当前方案

由于GitHub Pages的限制，当前应用已配置为**优雅降级**：
- ✅ 自动检测 `SharedArrayBuffer` 支持
- ✅ 在不支持时自动使用单线程模式
- ✅ 功能完全正常，只是没有并行化加速
- ✅ 不会影响任何现有功能

## 未来改进

如果需要启用并行化，可以考虑：
1. 迁移到支持自定义头部的托管平台（Netlify、Vercel等）
2. 使用自己的服务器（Nginx、Apache等）
3. 使用Cloudflare Workers或Edge Computing服务

## 相关文件

- `photon-wasm/Cargo.toml` - WASM构建配置
- `photon-wasm/.cargo/config.toml` - Rust编译配置
- `pkg/photon_wasm.js` - JavaScript绑定（包含 `initThreadPool`）
- `pkg/snippets/wasm-bindgen-rayon-*/src/workerHelpers.js` - Worker辅助代码