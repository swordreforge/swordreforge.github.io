# AI 智能助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在侧边栏添加 AI 聊天窗口，用户输入自然语言指令即可控制图像处理参数和滤镜。

**Architecture:** 纯前端直调 OpenAI Chat API，使用 function_calling 让 GPT 返回结构化函数调用（如 `{action: "apply_brightness", params: {level: 50}}`），前端接收后调用已有 WASM 图像处理方法。.env 存储 API Key。

**Tech Stack:** OpenAI API (gpt-4o-mini + function_calling), 原生 JS, 已有 WASM ImageProcessor

---

## File Structure

- Modify: `index.html` — 添加侧边栏 AI 助手 UI、聊天逻辑、API 调用、函数调度
- Modify: `.env` — 添加 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL 配置
- Create: `ai-functions.js` — 独立模块，定义 OpenAI function calling schema + 执行映射

---

### Task 1: 创建 ai-functions.js 函数定义和调度模块

**Files:**
- Create: `ai-functions.js`

- [ ] **Step 1: 创建 ai-functions.js，定义 function calling schema 和执行映射**

```javascript
// ai-functions.js
// OpenAI function calling 定义 + 执行映射

const AI_FUNCTION_DEFINITIONS = [
    {
        name: "adjust_brightness",
        description: "调整图像亮度",
        parameters: {
            type: "object",
            properties: {
                level: { type: "integer", description: "亮度值，范围-255到255，正值变亮，负值变暗" }
            },
            required: ["level"]
        }
    },
    {
        name: "adjust_contrast",
        description: "调整图像对比度",
        parameters: {
            type: "object",
            properties: {
                level: { type: "number", description: "对比度值，范围-255到255，正值增强，负值减弱" }
            },
            required: ["level"]
        }
    },
    {
        name: "adjust_saturation",
        description: "调整图像饱和度",
        parameters: {
            type: "object",
            properties: {
                level: { type: "number", description: "饱和度值，范围-1到1，正值增强色彩，负值减弱" }
            },
            required: ["level"]
        }
    },
    {
        name: "adjust_hue",
        description: "调整图像色相",
        parameters: {
            type: "object",
            properties: {
                level: { type: "integer", description: "色相值，范围-360到360" }
            },
            required: ["level"]
        }
    },
    {
        name: "adjust_temperature",
        description: "调整图像色温，正值变暖（偏黄/橙），负值变冷（偏蓝）",
        parameters: {
            type: "object",
            properties: {
                value: { type: "integer", description: "色温值，范围-100到100" }
            },
            required: ["value"]
        }
    },
    {
        name: "apply_filter",
        description: "应用预设滤镜",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "滤镜名称，可选值：oceanic, islands, marine, seagreen, flagblue, diamante, liquid, water, freshblue, lofi, vintage, dramatic, amber, lavender,TristenRamos, rosetint, hometown, fragole, sindoni, golden, pastelpink, coffee, perfume, boomer, bipo"
                }
            },
            required: ["name"]
        }
    },
    {
        name: "apply_grayscale",
        description: "将图像转为灰度",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_sepia",
        description: "将图像转为复古/褐色调",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_invert",
        description: "反转图像颜色（负片效果）",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_threshold",
        description: "将图像转为黑白二值图",
        parameters: {
            type: "object",
            properties: {
                threshold: { type: "integer", description: "阈值0-255" }
            },
            required: ["threshold"]
        }
    },
    {
        name: "apply_sharpen",
        description: "锐化图像",
        parameters: {
            type: "object",
            properties: {
                strength: { type: "number", description: "锐化强度0-10" }
            },
            required: ["strength"]
        }
    },
    {
        name: "apply_blur",
        description: "模糊/柔化图像",
        parameters: {
            type: "object",
            properties: {
                type: { type: "string", description: "模糊类型：gaussian, box", enum: ["gaussian", "box"] },
                radius: { type: "number", description: "模糊半径1-20" }
            },
            required: ["type", "radius"]
        }
    },
    {
        name: "apply_watermark",
        description: "添加水印文字",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "水印文字内容" },
                x: { type: "integer", description: "X坐标" },
                y: { type: "integer", description: "Y坐标" }
            },
            required: ["text"]
        }
    },
    {
        name: "rotate_image",
        description: "旋转图像",
        parameters: {
            type: "object",
            properties: {
                angle: { type: "integer", description: "旋转角度（90的倍数）" }
            },
            required: ["angle"]
        }
    },
    {
        name: "flip_image",
        description: "翻转图像",
        parameters: {
            type: "object",
            properties: {
                direction: { type: "string", description: "翻转方向：horizontal 或 vertical", enum: ["horizontal", "vertical"] }
            },
            required: ["direction"]
        }
    },
    {
        name: "reset_image",
        description: "重置图像到原始状态",
        parameters: { type: "object", properties: {} }
    }
];

function executeAiFunction(processor, functionName, params) {
    if (!processor) return { success: false, error: "没有加载图像" };

    try {
        switch (functionName) {
            case "adjust_brightness":
                processor.apply_brightness(params.level);
                break;
            case "adjust_contrast":
                processor.apply_contrast(params.level);
                break;
            case "adjust_saturation":
                processor.apply_saturation(params.level);
                break;
            case "adjust_hue":
                processor.apply_hue(params.level);
                break;
            case "adjust_temperature":
                processor.adjust_temperature(params.value);
                break;
            case "apply_filter":
                processor.apply_preset_filter(params.name);
                break;
            case "apply_grayscale":
                processor.apply_grayscale();
                break;
            case "apply_sepia":
                processor.apply_sepia();
                break;
            case "apply_invert":
                processor.apply_invert();
                break;
            case "apply_threshold":
                processor.apply_threshold(params.threshold);
                break;
            case "apply_sharpen":
                processor.apply_sharpen(params.strength);
                break;
            case "apply_blur":
                if (params.type === "gaussian") {
                    processor.apply_gaussian_blur(params.radius);
                } else {
                    processor.apply_box_blur(params.radius);
                }
                break;
            case "rotate_image":
                processor.rotate(params.angle);
                break;
            case "flip_image":
                if (params.direction === "horizontal") {
                    processor.flip_horizontal();
                } else {
                    processor.flip_vertical();
                }
                break;
            case "reset_image":
                processor.reset();
                break;
            default:
                return { success: false, error: "未知操作: " + functionName };
        }
        return { success: true, action: functionName, params: params };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

const FUNCTION_DISPLAY_NAMES = {
    adjust_brightness: "调整亮度",
    adjust_contrast: "调整对比度",
    adjust_saturation: "调整饱和度",
    adjust_hue: "调整色相",
    adjust_temperature: "调整色温",
    apply_filter: "应用滤镜",
    apply_grayscale: "灰度",
    apply_sepia: "复古",
    apply_invert: "反色",
    apply_threshold: "二值化",
    apply_sharpen: "锐化",
    apply_blur: "模糊",
    rotate_image: "旋转",
    flip_image: "翻转",
    reset_image: "重置",
    apply_watermark: "添加水印"
};

export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES };
```

- [ ] **Step 2: Commit**

```bash
git add ai-functions.js
git commit -m "feat: 添加 AI 函数定义和调度模块"
```

---

### Task 2: 在 index.html 侧边栏添加 AI 助手 UI

**Files:**
- Modify: `index.html` (侧边栏 HTML 部分)

- [ ] **Step 1: 在侧边栏最底部、图层管理 section 之后，添加 AI 助手 section**

在 `layersSection` 闭合 `</div>` 之后插入：

```html
<div class="section" id="aiAssistantSection">
    <h3>AI 助手 <span style="font-size: 0.7em; color: #667eea; margin-left: 8px;">🤖</span></h3>
    <div id="aiChatMessages" style="max-height: 200px; overflow-y: auto; background: #1a1a1a; border-radius: 6px; padding: 8px; margin-bottom: 8px; font-size: 0.85em; color: #ccc; display: none;">
    </div>
    <div style="display: flex; gap: 6px;">
        <input type="text" id="aiChatInput" placeholder="输入指令，如：亮度调高一点..." style="flex: 1; padding: 8px 10px; background: #333; color: #e0e0e0; border: 1px solid #555; border-radius: 6px; font-size: 0.9em; outline: none;" onkeydown="if(event.key==='Enter')sendAiMessage()">
        <button class="btn" onclick="sendAiMessage()" id="aiSendBtn" style="padding: 8px 12px;">发送</button>
    </div>
    <div id="aiApiKeyHint" style="margin-top: 6px; font-size: 0.75em; color: #888; cursor: pointer;" onclick="showAiConfig()">
        ⚙️ 点击配置 API Key
    </div>
</div>
```

- [ ] **Step 2: 添加 AI 配置弹窗 HTML**

在 `</body>` 之前添加配置弹窗：

```html
<div id="aiConfigModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:10000; display:none; align-items:center; justify-content:center;">
    <div style="background:#2a2a2a; border-radius:12px; padding:24px; width:400px; max-width:90vw; box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <h3 style="color:#e0e0e0; margin-bottom:16px;">AI 助手配置</h3>
        <div style="margin-bottom:12px;">
            <label style="color:#aaa; font-size:0.85em;">API Key</label>
            <input type="password" id="aiApiKeyInput" placeholder="sk-..." style="width:100%; padding:8px; background:#333; color:#e0e0e0; border:1px solid #555; border-radius:6px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="color:#aaa; font-size:0.85em;">API Base URL</label>
            <input type="text" id="aiApiBaseInput" placeholder="https://api.openai.com/v1" style="width:100%; padding:8px; background:#333; color:#e0e0e0; border:1px solid #555; border-radius:6px; margin-top:4px;">
        </div>
        <div style="margin-bottom:16px;">
            <label style="color:#aaa; font-size:0.85em;">模型</label>
            <input type="text" id="aiModelInput" placeholder="gpt-4o-mini" style="width:100%; padding:8px; background:#333; color:#e0e0e0; border:1px solid #555; border-radius:6px; margin-top:4px;">
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn" onclick="closeAiConfigModal()" style="padding:8px 16px;">取消</button>
            <button class="btn btn-success" onclick="saveAiConfig()" style="padding:8px 16px;">保存</button>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: 添加 AI 助手侧边栏 UI 和配置弹窗"
```

---

### Task 3: 实现 AI 聊天核心逻辑

**Files:**
- Modify: `index.html` (script module 部分添加 AI 聊天逻辑)

- [ ] **Step 1: 在 `<script type="module">` 区域中，添加 ai-functions.js 的 import 和 AI 核心逻辑**

在模块脚本区域（`loadWasmModule` 之后、图层管理功能之前）添加：

```javascript
// ==================== AI 助手功能 ====================

let aiFunctionsModule = null;

async function loadAiFunctions() {
    if (aiFunctionsModule) return aiFunctionsModule;
    aiFunctionsModule = await import('./ai-functions.js');
    return aiFunctionsModule;
}

const aiConfig = {
    apiKey: localStorage.getItem('ai_api_key') || '',
    baseUrl: localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1',
    model: localStorage.getItem('ai_model') || 'gpt-4o-mini'
};

const SYSTEM_PROMPT = `你是一个图像编辑助手。用户会用中文告诉你他们想要对图像做什么修改。
你需要调用合适的函数来完成任务。可用的函数包括调整亮度、对比度、饱和度、色相、色温、锐化、模糊、应用滤镜、旋转、翻转、重置图像等。
请根据用户的描述选择合适的函数和参数。回复简洁中文说明你做了什么。`;

window.showAiConfig = function() {
    const modal = document.getElementById('aiConfigModal');
    modal.style.display = 'flex';
    document.getElementById('aiApiKeyInput').value = aiConfig.apiKey;
    document.getElementById('aiApiBaseInput').value = aiConfig.baseUrl;
    document.getElementById('aiModelInput').value = aiConfig.model;
};

window.closeAiConfigModal = function() {
    document.getElementById('aiConfigModal').style.display = 'none';
};

window.saveAiConfig = function() {
    aiConfig.apiKey = document.getElementById('aiApiKeyInput').value.trim();
    aiConfig.baseUrl = document.getElementById('aiApiBaseInput').value.trim() || 'https://api.openai.com/v1';
    aiConfig.model = document.getElementById('aiModelInput').value.trim() || 'gpt-4o-mini';
    localStorage.setItem('ai_api_key', aiConfig.apiKey);
    localStorage.setItem('ai_base_url', aiConfig.baseUrl);
    localStorage.setItem('ai_model', aiConfig.model);
    closeAiConfigModal();
    updateAiKeyHint();
    addAiChatMessage('系统', '配置已保存 ✓', 'system');
};

function updateAiKeyHint() {
    const hint = document.getElementById('aiApiKeyHint');
    if (aiConfig.apiKey) {
        hint.textContent = '✅ API Key 已配置 | 点击修改';
        hint.style.color = '#4caf50';
    } else {
        hint.textContent = '⚙️ 点击配置 API Key';
        hint.style.color = '#888';
    }
}

let aiChatHistory = [];

function addAiChatMessage(role, content, type = 'normal') {
    const container = document.getElementById('aiChatMessages');
    container.style.display = 'block';
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = 'margin:4px 0;padding:6px 8px;border-radius:6px;word-break:break-word;';
    if (type === 'system') {
        msgDiv.style.background = '#1a3a2a';
        msgDiv.style.color = '#81c784';
    } else if (role === 'user') {
        msgDiv.style.background = '#1a2a3a';
        msgDiv.style.color = '#90caf9';
    } else {
        msgDiv.style.background = '#2a2a2a';
        msgDiv.style.color = '#e0e0e0';
    }
    const prefix = role === 'user' ? '你' : (type === 'system' ? '⚙️' : '🤖');
    msgDiv.innerHTML = `<span style="font-weight:600;">${prefix}:</span> ${content}`;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

window.sendAiMessage = async function() {
    const input = document.getElementById('aiChatInput');
    const message = input.value.trim();
    if (!message) return;

    if (!aiConfig.apiKey) {
        showAiConfig();
        return;
    }

    input.value = '';
    addAiChatMessage('user', message);

    const sendBtn = document.getElementById('aiSendBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = '思考中...';

    try {
        const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES } = await loadAiFunctions();

        aiChatHistory.push({ role: 'user', content: message });

        const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...aiChatHistory.slice(-10)
                ],
                tools: AI_FUNCTION_DEFINITIONS.map(f => ({ type: 'function', function: f })),
                tool_choice: 'auto',
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `API 错误 ${response.status}`);
        }

        const data = await response.json();
        const choice = data.choices[0];
        const assistantMsg = choice.message;

        let actionDescs = [];

        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            for (const toolCall of assistantMsg.tool_calls) {
                const fnName = toolCall.function.name;
                const fnParams = JSON.parse(toolCall.function.arguments);
                const result = executeAiFunction(appState.processor, fnName, fnParams);

                if (result.success) {
                    const displayName = FUNCTION_DISPLAY_NAMES[fnName] || fnName;
                    const paramDesc = Object.entries(fnParams).map(([k,v]) => `${k}=${v}`).join(', ');
                    actionDescs.push(`${displayName}(${paramDesc})`);
                    addAiChatMessage('assistant', `已执行: ${displayName}${paramDesc ? ' ' + paramDesc : ''}`);
                } else {
                    addAiChatMessage('assistant', `执行失败: ${result.error}`, 'system');
                }
            }
            saveToHistory();
            updateCanvas();
            aiChatHistory.push({ role: 'assistant', content: assistantMsg.content || actionDescs.join('；') });
        } else if (assistantMsg.content) {
            addAiChatMessage('assistant', assistantMsg.content);
            aiChatHistory.push({ role: 'assistant', content: assistantMsg.content });
        }

    } catch (error) {
        addAiChatMessage('assistant', `错误: ${error.message}`, 'system');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
    }
};

updateAiKeyHint();
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: 实现 AI 聊天核心逻辑（OpenAI function_calling + 函数调度）"
```

---

### Task 4: 添加 .env 配置和 CSS 样式微调

**Files:**
- Modify: `.env` (添加 AI 配置模板)
- Modify: `index.html` (CSS 微调)

- [ ] **Step 1: 更新 .env 文件，添加 AI 配置模板**

在 `.env` 中追加（如果文件不存在则创建）：

```
# AI 助手配置
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 2: 在 index.html 的 `<style>` 区域，添加 AI 聊天相关 CSS**

在已有的样式区域末尾添加：

```css
#aiChatMessages::-webkit-scrollbar { width: 4px; }
#aiChatMessages::-webkit-scrollbar-track { background: transparent; }
#aiChatMessages::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }
#aiChatInput:focus { border-color: #667eea; }
#aiChatInput::placeholder { color: #888; }
```

- [ ] **Step 3: Commit**

```bash
git add .env index.html
git commit -m "feat: 添加 AI 助手 .env 配置模板和 CSS 微调"
```

---

### Task 5: 集成测试和验证

**Files:**
- Modify: `index.html` (如需修复)

- [ ] **Step 1: 启动服务器，打开浏览器访问应用**

```bash
cd /home/swordreforge/projects/wasm-test && python3 -m http.server 7777
```

- [ ] **Step 2: 验证以下功能**

1. 侧边栏底部出现 "AI 助手 🤖" section
2. 点击 ⚙️ 可打开配置弹窗，保存 API Key
3. 输入 "把亮度调高" → GPT 返回 adjust_brightness → 画布亮度变化
4. 输入 "加个复古滤镜" → GPT 返回 apply_filter sepia → 画布变复古
5. 输入 "重置" → GPT 返回 reset_image → 画布恢复原状
6. 无 Key 时点击发送，弹出配置窗口

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: AI 智能助手集成完成"
```