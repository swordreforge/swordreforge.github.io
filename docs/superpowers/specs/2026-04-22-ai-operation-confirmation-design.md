# AI 助手操作确认机制设计

**日期**: 2026-04-22
**状态**: 已批准

## 问题

当前 AI 助手收到 LLM 返回的 tool_calls 后**立即全部执行**，用户无法预览或拒绝操作。破坏性操作（抠图、灰度、像素化等）一旦执行，只能通过 undo 栈回退，但 undo 可能回退到更早的状态而非仅撤销该步操作。

## 目标

- 破坏性操作执行前需用户确认
- 非破坏性操作（亮度、对比度等）保持即时执行
- 用户可通过全局开关关闭确认机制
- 确认 UI 以内联卡片形式嵌入聊天流

## 设计

### 1. 破坏性操作分类

需要确认的操作（`RISKY_FUNCTIONS`）：

| 函数 | 中文名 | 破坏原因 |
|------|--------|----------|
| `smart_crop` | 智能抠图 | 自动去背景，不可逆 |
| `apply_circular_mask` | 圆形抠图 | 圆外区域变透明 |
| `auto_crop_by_color` | 颜色抠图 | 匹配色外区域变透明 |
| `apply_threshold` | 二值化 | 丢失全部色彩信息 |
| `apply_grayscale` | 灰度 | 丢失色彩信息 |
| `apply_sepia` | 复古 | 色彩偏移严重 |
| `apply_invert` | 反色 | 色彩完全反转 |
| `apply_pixelate` | 像素化 | 细节不可恢复丢失 |
| `apply_oil` | 油画 | 细节严重丢失 |
| `apply_emboss` | 浮雕 | 细节严重丢失 |
| `apply_solarize` | 曝光过度 | 色彩信息丢失 |
| `reset_image` | 重置 | 清除所有编辑 |

不需要确认的操作：`adjust_brightness`, `adjust_contrast`, `adjust_saturation`, `adjust_hue`, `adjust_temperature`, `apply_sharpen`, `apply_blur`, `apply_vignette`, `apply_tint`, `apply_noise`, `apply_duotone`, `apply_filter`, `rotate_image`, `flip_image`, `draw_brush_stroke`, `draw_text`, `undo`, `redo`

### 2. 执行流程改造

**当前流程**（单阶段）：
```
收到 tool_calls → 逐个执行 → 返回 tool results → 继续/结束
```

**改造后流程**（两阶段）：
```
收到 tool_calls:
  1. 遍历所有 tool_calls，分为两组：
     - safeCalls: 非破坏性操作 → 立即执行
     - riskyCalls: 破坏性操作 → 收集到待确认队列
  2. 执行所有 safeCalls，将结果推入 aiChatHistory（tool messages）
  3. 如果 riskyCalls 非空 且 确认开关开启：
     - 在聊天窗口渲染内联确认卡片
     - 暂停执行循环，等待用户交互
  4. 用户点击"执行"：
     - 执行 riskyCalls，更新 canvas
     - 将结果推入 aiChatHistory（tool messages）
     - 卡片状态变为"已执行"
     - 恢复执行循环
  5. 用户点击"取消"：
     - 不执行 riskyCalls
     - 向 tool response 返回 { success: false, error: "用户取消了此操作" }
     - 将 tool messages 推入 aiChatHistory
     - 卡片状态变为"已取消"
     - 恢复执行循环
```

### 3. 暂停/恢复机制

当前 `sendAiMessage` 有 `MAX_TURNS=10` 的 for 循环。改造后需要在循环中间暂停等待用户确认。

实现方式：
```javascript
// 暂停用的 Promise + 外部 resolve 函数
let confirmResolve = null;

function waitForConfirm() {
    return new Promise(function(resolve) {
        confirmResolve = resolve;
    });
}

// 用户点击"执行"或"取消"时调用
function resolveConfirm(confirmed) {
    if (confirmResolve) {
        confirmResolve(confirmed);
        confirmResolve = null;
    }
}
```

循环中遇到 riskyCalls 时：
```javascript
const confirmed = await waitForConfirm();
if (!confirmed) {
    // 构建取消的 tool responses
}
// 继续循环
```

### 4. 内联确认卡片 UI

在聊天消息流中插入一个特殊 DOM 元素：

```
┌──────────────────────────────────────────┐
│ ⚠ 待确认操作                              │
│                                          │
│  1. 智能抠图 (threshold=50, feather=2)    │
│  2. 灰度                                  │
│                                          │
│  [✓ 执行]              [✕ 取消]           │
└──────────────────────────────────────────┘
```

CSS 样式：
- 左边框 3px 橙色 (#ff9800)
- 背景 #2a2520（暖色调深色）
- 文字色 #e0e0e0
- 操作列表中每条带圆点标记
- "执行"按钮：绿色 (#4aaa6b)
- "取消"按钮：灰色 (#555)
- 确认/取消后卡片变灰，按钮禁用，显示状态文字

### 5. 全局开关

在 AI 配置弹窗 (`aiConfigModal`) 中新增：
- 标签："操作确认"
- 开关控件：checkbox
- 默认：开启
- 存储键：`localStorage` 的 `ai_confirm_enabled`
- 关闭时所有操作直接执行，等同当前行为

### 6. 发送按钮状态

当有待确认操作时，发送按钮保持禁用状态（显示"待确认..."），防止用户在确认前发送新消息造成状态混乱。

确认完成后恢复为"发送"。

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `index.html` (script) | 改造 `sendAiMessage` 的执行循环，增加 RISKY_FUNCTIONS 判断、确认卡片渲染、暂停/恢复逻辑、全局开关读取 |
| `index.html` (CSS) | 新增确认卡片样式 |
| `index.html` (HTML) | AI 配置弹窗新增确认开关 checkbox |
| `ai-functions.js` | 新增 `RISKY_FUNCTIONS` 集合 export |

## 不涉及的部分

- 不改变 API 调用逻辑
- 不改变 undo/redo 机制
- 不改变 aiChatHistory 存储格式
- 不改变 operation log 逻辑
