# AI 操作确认机制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 助手执行破坏性操作前增加用户确认环节，防止不可逆操作被误执行。

**Architecture:** 在 `sendAiMessage` 的 tool_call 执行循环中，将操作分为 safe/risky 两组。safe 操作立即执行，risky 操作暂停循环并在聊天中渲染内联确认卡片，用户确认后才继续执行。使用 Promise resolve 实现暂停/恢复。

**Tech Stack:** 原生 JS，已有 ai-functions.js 模块，localStorage 持久化开关

---

## File Structure

| 文件 | 职责 |
|------|------|
| `ai-functions.js` | 新增 `RISKY_FUNCTIONS` Set 导出 |
| `index.html` (CSS) | 新增确认卡片样式 |
| `index.html` (HTML) | AI 配置弹窗新增确认开关 checkbox |
| `index.html` (JS) | 改造 `sendAiMessage` 执行循环，新增暂停/恢复/卡片渲染逻辑 |

---

### Task 1: 在 ai-functions.js 新增 RISKY_FUNCTIONS Set

**Files:**
- Modify: `ai-functions.js`

- [ ] **Step 1: 在 `ai-functions.js` 末尾 `export` 语句之前，新增 RISKY_FUNCTIONS 定义和导出**

在 `FUNCTION_DISPLAY_NAMES` 对象闭合 `};` 之后、`export` 语句之前插入：

```javascript
const RISKY_FUNCTIONS = new Set([
    "smart_crop",
    "apply_circular_mask",
    "auto_crop_by_color",
    "apply_threshold",
    "apply_grayscale",
    "apply_sepia",
    "apply_invert",
    "apply_pixelate",
    "apply_oil",
    "apply_emboss",
    "apply_solarize",
    "reset_image"
]);
```

修改 export 行为：

```javascript
export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS };
```

- [ ] **Step 2: Commit**

```bash
git add ai-functions.js
git commit -m "feat: add RISKY_FUNCTIONS set for operation confirmation"
```

---

### Task 2: 新增确认卡片 CSS 样式

**Files:**
- Modify: `index.html` (CSS 区域)

- [ ] **Step 1: 在 `#aiChatInput::placeholder` 规则之后，`.ai-sidebar` 规则之前，插入确认卡片样式**

```css
        .ai-confirm-card {
            margin: 8px 0;
            padding: 10px 12px;
            background: #2a2520;
            border-left: 3px solid #ff9800;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 0.85em;
        }
        .ai-confirm-card .confirm-title {
            font-weight: 600;
            color: #ff9800;
            margin-bottom: 6px;
        }
        .ai-confirm-card .confirm-item {
            padding: 2px 0;
            padding-left: 12px;
            color: #ccc;
        }
        .ai-confirm-card .confirm-actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        .ai-confirm-card .confirm-btn {
            padding: 5px 14px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            font-weight: 600;
        }
        .ai-confirm-card .confirm-btn-execute {
            background: #4aaa6b;
            color: white;
        }
        .ai-confirm-card .confirm-btn-execute:hover {
            background: #5bbb7c;
        }
        .ai-confirm-card .confirm-btn-cancel {
            background: #555;
            color: #ccc;
        }
        .ai-confirm-card .confirm-btn-cancel:hover {
            background: #666;
        }
        .ai-confirm-card.resolved {
            opacity: 0.5;
            border-left-color: #555;
        }
        .ai-confirm-card.resolved .confirm-title {
            color: #888;
        }
        .ai-confirm-card.resolved .confirm-btn {
            cursor: default;
            pointer-events: none;
        }
        .ai-confirm-card.resolved.confirmed .confirm-title::after {
            content: ' — 已执行';
            color: #4aaa6b;
        }
        .ai-confirm-card.resolved.cancelled .confirm-title::after {
            content: ' — 已取消';
            color: #ff6b6b;
        }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add confirmation card CSS styles"
```

---

### Task 3: AI 配置弹窗新增确认开关

**Files:**
- Modify: `index.html` (HTML — aiConfigModal 区域, 约 line 14561-14581)

- [ ] **Step 1: 在 aiConfigModal 的"模型"输入框 div 之后、底部按钮 div 之前，插入确认开关 checkbox**

在 `id="aiModelInput"` 的 `</div>` 闭合标签之后、底部按钮 `<div style="display:flex; gap:8px; justify-content:flex-end;">` 之前插入：

```html
            <div style="margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="aiConfirmEnabled" checked style="width:auto; margin:0;">
                <label for="aiConfirmEnabled" style="color:#aaa; font-size:0.85em; cursor:pointer;">破坏性操作需确认</label>
            </div>
```

- [ ] **Step 2: 在 `window.showAiConfig` 函数中加载确认开关状态**

在 `document.getElementById('aiModelInput').value = aiConfig.model;` 之后追加：

```javascript
                document.getElementById('aiConfirmEnabled').checked = aiConfig.confirmEnabled;
```

- [ ] **Step 3: 在 `window.saveAiConfig` 函数中保存确认开关状态**

在 `localStorage.setItem('ai_model', aiConfig.model);` 之后追加：

```javascript
                aiConfig.confirmEnabled = document.getElementById('aiConfirmEnabled').checked;
                localStorage.setItem('ai_confirm_enabled', aiConfig.confirmEnabled ? '1' : '0');
```

- [ ] **Step 4: 在 `aiConfig` 对象初始化时读取确认开关**

将 `index.html` 中 `aiConfig` 对象从：

```javascript
        const aiConfig = {
            apiKey: localStorage.getItem('ai_api_key') || '',
            baseUrl: localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1',
            model: localStorage.getItem('ai_model') || 'gpt-4o-mini'
        };
```

改为：

```javascript
        const aiConfig = {
            apiKey: localStorage.getItem('ai_api_key') || '',
            baseUrl: localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1',
            model: localStorage.getItem('ai_model') || 'gpt-4o-mini',
            confirmEnabled: localStorage.getItem('ai_confirm_enabled') !== '0'
        };
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add confirmation toggle in AI config modal"
```

---

### Task 4: 改造 sendAiMessage 执行循环 — 核心逻辑

**Files:**
- Modify: `index.html` (JS — sendAiMessage 函数, 约 line 3540-3707)

这是最核心的改动。需要重构 `sendAiMessage` 中 tool_calls 的执行逻辑，将原先的"逐个立即执行"改为"safe 立即执行 + risky 暂停确认"。

- [ ] **Step 1: 在 `loadAiFunctions` 函数附近新增暂停/恢复工具函数和确认卡片渲染函数**

在 `updateAiKeyHint` 函数定义之后、`addAiChatMessage` 函数之前插入：

```javascript
        let confirmResolve = null;

        function waitForConfirm() {
            return new Promise(function(resolve) {
                confirmResolve = resolve;
            });
        }

        function resolveConfirm(confirmed) {
            if (confirmResolve) {
                confirmResolve(confirmed);
                confirmResolve = null;
            }
        }

        function renderConfirmCard(riskyCalls, displayNames) {
            const container = document.getElementById('aiChatMessages');
            const card = document.createElement('div');
            card.className = 'ai-confirm-card';
            card.id = 'aiConfirmCard_' + Date.now();

            let itemsHtml = '';
            for (let i = 0; i < riskyCalls.length; i++) {
                const tc = riskyCalls[i];
                const fnName = tc.function.name;
                let fnParams;
                try { fnParams = JSON.parse(tc.function.arguments); } catch(e) { fnParams = {}; }
                const displayName = displayNames[fnName] || fnName;
                const paramDesc = Object.entries(fnParams).map(function(e) { return e[0] + '=' + e[1]; }).join(', ');
                itemsHtml += '<div class="confirm-item">' + (i + 1) + '. ' + displayName + (paramDesc ? ' (' + paramDesc + ')' : '') + '</div>';
            }

            card.innerHTML = '<div class="confirm-title">\u26A0\uFE0F \u5F85\u786E\u8BA4\u64CD\u4F5C</div>' +
                itemsHtml +
                '<div class="confirm-actions">' +
                '<button class="confirm-btn confirm-btn-execute" onclick="handleAiConfirm(true, \'' + card.id + '\')">\u2713 \u6267\u884C</button>' +
                '<button class="confirm-btn confirm-btn-cancel" onclick="handleAiConfirm(false, \'' + card.id + '\')">\u2715 \u53D6\u6D88</button>' +
                '</div>';

            container.appendChild(card);
            container.scrollTop = container.scrollHeight;
            return card.id;
        }

        window.handleAiConfirm = function(confirmed, cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
            card.classList.add('resolved');
            if (confirmed) {
                card.classList.add('confirmed');
            } else {
                card.classList.add('cancelled');
            }
            const btns = card.querySelectorAll('.confirm-btn');
            btns.forEach(function(b) { b.disabled = true; });
            resolveConfirm(confirmed);
        };
```

- [ ] **Step 2: 重构 sendAiMessage 中的 tool_calls 执行逻辑**

将 `sendAiMessage` 函数中，从 `if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {` 开始到对应 `} else {` 之前的整个 tool_calls 处理块替换为以下代码。

替换的起始标记（含）：`if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {`
替换的结束标记（不含）：`} else {`

替换为：

```javascript
                    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
                        aiChatHistory.push(assistantMsg);
                        persistAiChatHistory();

                        // 分离 safe 和 risky 操作
                        const safeCalls = [];
                        const riskyCalls = [];
                        for (let i = 0; i < assistantMsg.tool_calls.length; i++) {
                            const tc = assistantMsg.tool_calls[i];
                            if (aiConfig.confirmEnabled && RISKY_FUNCTIONS.has(tc.function.name)) {
                                riskyCalls.push(tc);
                            } else {
                                safeCalls.push(tc);
                            }
                        }

                        // 立即执行 safe 操作
                        let turnActionDescs = [];
                        for (let i = 0; i < safeCalls.length; i++) {
                            const toolCall = safeCalls[i];
                            const fnName = toolCall.function.name;
                            let fnParams;
                            try { fnParams = JSON.parse(toolCall.function.arguments); } catch(e) { fnParams = {}; }

                            let result;
                            if (fnName === 'undo') {
                                try {
                                    await undo();
                                    result = { success: true, action: fnName, params: fnParams };
                                } catch(e) {
                                    result = { success: false, error: e.message };
                                }
                            } else if (fnName === 'redo') {
                                try {
                                    await redo();
                                    result = { success: true, action: fnName, params: fnParams };
                                } catch(e) {
                                    result = { success: false, error: e.message };
                                }
                            } else if (fnName === 'apply_circular_mask') {
                                try {
                                    const w = appState.processor.get_width();
                                    const h = appState.processor.get_height();
                                    const cx = fnParams.center_x !== undefined ? fnParams.center_x : w / 2;
                                    const cy = fnParams.center_y !== undefined ? fnParams.center_y : h / 2;
                                    const r = fnParams.radius !== undefined ? fnParams.radius : Math.min(w, h) * 0.3;
                                    const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                    appState.processor.apply_circular_mask(cx, cy, r, f);
                                    result = { success: true, action: fnName, params: fnParams };
                                } catch(e) {
                                    result = { success: false, error: e.message };
                                }
                            } else if (fnName === 'auto_crop_by_color') {
                                try {
                                    const tol = fnParams.tolerance !== undefined ? fnParams.tolerance : 30;
                                    const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                    appState.processor.auto_crop_by_color(fnParams.r, fnParams.g, fnParams.b, tol, f);
                                    result = { success: true, action: fnName, params: fnParams };
                                } catch(e) {
                                    result = { success: false, error: e.message };
                                }
                            } else if (fnName === 'smart_crop') {
                                try {
                                    const t = fnParams.threshold !== undefined ? fnParams.threshold : 50;
                                    const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                    appState.processor.smart_crop(t, f);
                                    result = { success: true, action: fnName, params: fnParams };
                                } catch(e) {
                                    result = { success: false, error: e.message };
                                }
                            } else {
                                result = executeAiFunction(appState.processor, fnName, fnParams);
                            }
                            const displayName = FUNCTION_DISPLAY_NAMES[fnName] || fnName;
                            const paramDesc = Object.entries(fnParams).map(function(e) { return e[0] + '=' + e[1]; }).join(', ');

                            if (result.success) {
                                aiLogOperation(fnName, fnParams);
                            }

                            aiChatHistory.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: result.success
                                    ? JSON.stringify({ success: true, action: fnName, params: fnParams })
                                    : JSON.stringify({ success: false, error: result.error })
                            });
                            persistAiChatHistory();

                            if (result.success) {
                                turnActionDescs.push(displayName + (paramDesc ? ' ' + paramDesc : ''));
                                addAiChatMessage('assistant', '\u5DF2\u6267\u884C: ' + displayName + (paramDesc ? ' ' + paramDesc : ''));
                            } else {
                                addAiChatMessage('assistant', '\u6267\u884C\u5931\u8D25: ' + result.error, 'system');
                            }
                        }

                        // safe 操作有结果时保存历史和刷新画布
                        if (turnActionDescs.length > 0) {
                            const hasUndoRedo = safeCalls.some(function(tc) {
                                return tc.function.name === 'undo' || tc.function.name === 'redo';
                            });
                            if (!hasUndoRedo) {
                                saveToHistory();
                            }
                            updateCanvas();
                        }

                        // 处理 risky 操作（需要确认）
                        if (riskyCalls.length > 0) {
                            const cardId = renderConfirmCard(riskyCalls, FUNCTION_DISPLAY_NAMES);
                            sendBtn.disabled = true;
                            sendBtn.textContent = '\u5F85\u786E\u8BA4...';

                            const confirmed = await waitForConfirm();

                            sendBtn.disabled = false;
                            sendBtn.textContent = '\u53D1\u9001';

                            if (confirmed) {
                                // 执行 risky 操作
                                for (let i = 0; i < riskyCalls.length; i++) {
                                    const toolCall = riskyCalls[i];
                                    const fnName = toolCall.function.name;
                                    let fnParams;
                                    try { fnParams = JSON.parse(toolCall.function.arguments); } catch(e) { fnParams = {}; }

                                    let result;
                                    if (fnName === 'apply_circular_mask') {
                                        try {
                                            const w = appState.processor.get_width();
                                            const h = appState.processor.get_height();
                                            const cx = fnParams.center_x !== undefined ? fnParams.center_x : w / 2;
                                            const cy = fnParams.center_y !== undefined ? fnParams.center_y : h / 2;
                                            const r = fnParams.radius !== undefined ? fnParams.radius : Math.min(w, h) * 0.3;
                                            const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                            appState.processor.apply_circular_mask(cx, cy, r, f);
                                            result = { success: true, action: fnName, params: fnParams };
                                        } catch(e) {
                                            result = { success: false, error: e.message };
                                        }
                                    } else if (fnName === 'auto_crop_by_color') {
                                        try {
                                            const tol = fnParams.tolerance !== undefined ? fnParams.tolerance : 30;
                                            const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                            appState.processor.auto_crop_by_color(fnParams.r, fnParams.g, fnParams.b, tol, f);
                                            result = { success: true, action: fnName, params: fnParams };
                                        } catch(e) {
                                            result = { success: false, error: e.message };
                                        }
                                    } else if (fnName === 'smart_crop') {
                                        try {
                                            const t = fnParams.threshold !== undefined ? fnParams.threshold : 50;
                                            const f = fnParams.feather !== undefined ? fnParams.feather : 2;
                                            appState.processor.smart_crop(t, f);
                                            result = { success: true, action: fnName, params: fnParams };
                                        } catch(e) {
                                            result = { success: false, error: e.message };
                                        }
                                    } else if (fnName === 'reset_image') {
                                        try {
                                            appState.processor.reset();
                                            result = { success: true, action: fnName, params: fnParams };
                                        } catch(e) {
                                            result = { success: false, error: e.message };
                                        }
                                    } else {
                                        result = executeAiFunction(appState.processor, fnName, fnParams);
                                    }

                                    const displayName = FUNCTION_DISPLAY_NAMES[fnName] || fnName;
                                    const paramDesc = Object.entries(fnParams).map(function(e) { return e[0] + '=' + e[1]; }).join(', ');

                                    if (result.success) {
                                        aiLogOperation(fnName, fnParams);
                                    }

                                    aiChatHistory.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: result.success
                                            ? JSON.stringify({ success: true, action: fnName, params: fnParams })
                                            : JSON.stringify({ success: false, error: result.error })
                                    });
                                    persistAiChatHistory();

                                    if (result.success) {
                                        turnActionDescs.push(displayName + (paramDesc ? ' ' + paramDesc : ''));
                                        addAiChatMessage('assistant', '\u5DF2\u6267\u884C: ' + displayName + (paramDesc ? ' ' + paramDesc : ''));
                                    } else {
                                        addAiChatMessage('assistant', '\u6267\u884C\u5931\u8D25: ' + result.error, 'system');
                                    }
                                }

                                if (turnActionDescs.length > 0 || riskyCalls.length > 0) {
                                    const hasUndoRedo = riskyCalls.some(function(tc) {
                                        return tc.function.name === 'undo' || tc.function.name === 'redo' || tc.function.name === 'reset_image';
                                    });
                                    if (hasUndoRedo) {
                                        // reset_image 不走 saveToHistory，而是清空历史
                                        aiOnImageReset();
                                    } else {
                                        saveToHistory();
                                    }
                                    updateCanvas();
                                }
                            } else {
                                // 用户取消：为每个 risky call 生成取消的 tool response
                                for (let i = 0; i < riskyCalls.length; i++) {
                                    const toolCall = riskyCalls[i];
                                    aiChatHistory.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ success: false, error: '\u7528\u6237\u53D6\u6D88\u4E86\u6B64\u64CD\u4F5C' })
                                    });
                                }
                                persistAiChatHistory();
                                addAiChatMessage('assistant', '\u5DF2\u53D6\u6D88\u64CD\u4F5C', 'system');
                            }
                        }

                        allActionDescs = allActionDescs.concat(turnActionDescs);

                        if (choice.finish_reason === 'stop') break;
```

- [ ] **Step 3: 修改 loadAiFunctions 调用处，解构新增的 RISKY_FUNCTIONS**

将 `sendAiMessage` 函数开头的解构从：

```javascript
                const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES } = await loadAiFunctions();
```

改为：

```javascript
                const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS } = await loadAiFunctions();
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: implement operation confirmation with inline card UI"
```

---

### Task 5: 集成验证

**Files:**
- Modify: `index.html` (如需修复)

- [ ] **Step 1: 启动本地服务器**

```bash
cd /home/swordreforge/projects/wasm-test && python3 -m http.server 7777
```

- [ ] **Step 2: 手动验证以下场景**

1. 打开 AI 配置弹窗，确认"破坏性操作需确认" checkbox 存在且默认勾选
2. 输入"变成黑白" → 应出现确认卡片，有"执行"和"取消"按钮
3. 点击"取消" → 卡片显示"已取消"，画布不变
4. 输入"调亮一点" → 应直接执行，不出现确认卡片
5. 输入"智能抠图" → 应出现确认卡片
6. 点击"执行" → 卡片显示"已执行"，画布变化
7. 取消勾选"破坏性操作需确认" → 保存后输入"变成黑白" → 应直接执行
8. 发送按钮在等待确认期间显示"待确认..."且禁用

- [ ] **Step 3: 最终 Commit（如有修复）**

```bash
git add -A
git commit -m "fix: operation confirmation integration fixes"
```
