# AI 本地推理集成设计方案

## 概述

为 WebAssembly 图像处理器增加本地 LLM 推理能力，与现有远程 OpenAI API 构成双后端可切换架构。用户可自由选择使用本地模型（通过 wllama/llama.cpp WASM 绑定）或远程 API 来驱动 AI 智能改图。

## 双后端架构

```
                    ┌──────────────┐
                    │  用户输入消息  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  AiEngine    │  ← 统一接口
                    │  .chat()     │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼──┐ ┌──▼──────────┐
              │ Wllama    │ │ Remote      │
              │ Backend   │ │ Backend     │
              │ (worker)  │ │ (fetch)     │
              └─────┬─────┘ └──────┬──────┘
                    │              │
              ┌─────▼─────┐       │
              │ llama.cpp │       │
              │ WASM      │       │
              └───────────┘       │
                                  │
              ┌───────────────────▼──────┐
              │  executeToolCall()       │
              │  → photon_wasm 图像操作   │
              └──────────────────────────┘
```

### AiEngine

统一的推理引擎接口，屏蔽后端差异。

```js
class AiEngine {
  constructor()
  async switchBackend(type)       // 'local' | 'remote'
  async chat(messages, tools)     // 返回 OAI-compatible response
  async loadModel(modelConfig)    // 仅 local 需要
  async unloadModel()             // 仅 local 需要
  getBackendStatus()              // { type, modelLoaded, modelName }
}
```

### WllamaBackend

封装 wllama 实例，运行在 Web Worker 中不阻塞 UI。

```js
class WllamaBackend {
  constructor()
  async init()                           // 初始化 wllama 实例
  async loadModel(config)                // 加载 GGUF 模型（HF/文件/缓存）
  async unloadModel()
  async chat(messages, tools)            // createChatCompletion 封装
  getStatus()                            // { loaded, modelName, isMultimodal }
}
```

### ModelManager

模型管理，包含预设模型、下载、缓存、上传。

```js
class ModelManager {
  static PRESET_MODELS = [...]           // 预设模型列表
  async downloadModel(preset)            // HF 下载 → OPFS 缓存
  async loadFromFile(file)               // 用户上传 .gguf
  getCachedModels()                      // 已缓存模型列表
  async deleteCachedModel(id)            // 删除缓存
}
```

## 预设模型

| ID | 名称 | 类型 | HF Repo | 文件 | mmproj | 大小 |
|---|---|---|---|---|---|---|
| `qwen2.5-1.5b` | Qwen2.5-1.5B-Instruct | standard | `Qwen/Qwen2.5-1.5B-Instruct-GGUF` | `qwen2.5-1.5b-instruct-q4_k_m.gguf` | 无 | ~1.1GB |
| `qwen2.5-vl-3b` | Qwen2.5-VL-3B-Instruct | multimodal | `ggml-org/Qwen2.5-VL-3B-Instruct-GGUF` | `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` | `mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf` | ~1.8GB |

## Function Calling 兼容性

AI_FUNCTION_DEFINITIONS（ai-functions.js）中原有的 30+ 工具定义**完全复用**：
- 本地后端：wllama.createChatCompletion() 原生支持 tools/tool_choice
- 远程后端：保持不变 fetch → /chat/completions
- 返回格式均为 OAI-compatible，executeToolCall() 逻辑不变

## 模型加载流程

### 预设模型加载（HF → OPFS 缓存）

```
用户选择预设模型 → wllama.loadModelFromHF({ repo, file })
                 → 检查 OPFS 缓存
                 → 未缓存：下载 + 进度回调 → OPFS 存储
                 → 已缓存：直接从 OPFS 加载（秒开）
                 → 加载到 WASM heap → 就绪
```

### 用户上传模型文件

```
用户点击上传 → <input type="file" accept=".gguf">
             → 读取 File 对象
             → wllama.loadModel([blob])
             → 加载到 WASM heap → 就绪
```

### 缓存管理

wllama 内置 OPFS 缓存机制，存储于浏览器 Origin Private File System。首次下载后自动缓存，后续加载无需重新下载。提供 UI 查看已缓存模型列表、删除缓存。

## 多模态支持

当加载多模态模型时：
1. WllamaBackend 自动加载 mmproj 文件
2. chat() 时将 canvas 图像数据作为 multimodal content 传入
3. 模型可以"看到"当前图像内容后决策改图参数

```js
// 多模态消息格式（wllama 支持）
messages = [
  {
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: canvasDataUrl } },
      { type: 'text', text: '请把这张图片里的花朵调得更红' }
    ]
  }
]
```

## 分阶段实现计划

## 集成方式

wllama 以源码形式存在于 `wllama/` 目录，但生产使用需要其构建产物（`esm/index.js` + `wasm/*`）。

采用**本地构建 + ESM 直接引入**方式：
1. 首次：在 `wllama/` 下执行 `npm run build`，产出 `esm/` 目录
2. 应用侧通过 `import { Wllama } from './wllama/esm/index.js'` 引入
3. wasm 文件通过 `pathConfig` 指向本地 `wllama/src/wasm/` 路径

### Phase 1: 核心引擎 + 本地 function calling

**目标**: 双后端可切换，AI 改图在 local 模式下跑通

- 构建 wllama：先 build 出 esm/ 产物
- 编写 AiEngine 核心类（WllamaBackend + RemoteBackend）
- 预设模型配置（仅 qwen2.5-1.5b）
- 用户设置面板：后端切换开关
- 本地模型加载逻辑（从已下载的文件路径加载，避免重复下载）
- 基本 function calling 流程验证

### Phase 2: 模型管理 UI

**目标**: 完整的模型管理体验

- ModelManager 完善：HF 下载进度、OPFS 缓存查询
- 模型管理面板：预设模型列表 + 下载按钮 + 进度条
- 本地模型文件上传（.gguf 选择器）
- 已缓存模型展示 + 删除功能

### Phase 3: 多模态集成

**目标**: AI 能"看见"图像内容

- 加载 mmproj 文件
- chat() 传入 canvas pixels
- 多模态模型预设（qwen2.5-vl-3b）
- 非多模态模型时自动降级为纯文本 prompt

### Phase 4: 体验优化

**目标**: 打磨细节

- 后端正向/反向切换（推理中不可切换）
- 模型加载/卸载状态反馈
- 错误处理与用户提示
- 缓存占用空间显示
- 加载耗时统计
