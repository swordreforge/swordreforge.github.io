# AI笔刷理解增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过增强Prompt上下文和新增`draw_brush_intent`意图函数，让AI能准确使用笔刷功能绘制各种图形。

**Architecture:** 两阶段方案——阶段一在system prompt中注入图像尺寸、九宫格区域坐标和笔刷选型指南；阶段二新增`draw_brush_intent`函数，AI传入区域+形状等语义参数，前端自动生成精确坐标路径后调用底层draw_brush_stroke。

**Tech Stack:** 原生JavaScript，修改 ai-functions.js 和 index.html

---

### Task 1: 在 ai-functions.js 中新增形状生成器和意图解析器

**Files:**
- Modify: `ai-functions.js`

- [ ] **Step 1: 在 ai-functions.js 末尾（export行之前）添加形状生成辅助函数**

```javascript
function generateEllipsePoints(cx, cy, rx, ry, numPoints) {
    var points = [];
    for (var i = 0; i <= numPoints; i++) {
        var angle = (2 * Math.PI * i) / numPoints;
        points.push([
            Math.round(cx + rx * Math.cos(angle)),
            Math.round(cy + ry * Math.sin(angle))
        ]);
    }
    return points;
}

function generateWavePoints(cx, cy, rx, amplitude, numPoints) {
    var points = [];
    for (var i = 0; i <= numPoints; i++) {
        var t = i / numPoints;
        var x = cx - rx + 2 * rx * t;
        var y = cy + amplitude * Math.sin(t * 4 * Math.PI);
        points.push([Math.round(x), Math.round(y)]);
    }
    return points;
}

function generateArrowPoints(cx, cy, rx, ry, direction) {
    var hs = Math.min(rx, ry) * 0.4;
    switch (direction) {
        case "right": return [[Math.round(cx-rx), Math.round(cy)], [Math.round(cx+rx*0.6), Math.round(cy)], [Math.round(cx+rx*0.6-hs), Math.round(cy-hs)], [Math.round(cx+rx*0.6), Math.round(cy)], [Math.round(cx+rx*0.6-hs), Math.round(cy+hs)], [Math.round(cx+rx*0.6), Math.round(cy)], [Math.round(cx+rx), Math.round(cy)]];
        case "left":  return [[Math.round(cx+rx), Math.round(cy)], [Math.round(cx-rx*0.6), Math.round(cy)], [Math.round(cx-rx*0.6+hs), Math.round(cy-hs)], [Math.round(cx-rx*0.6), Math.round(cy)], [Math.round(cx-rx*0.6+hs), Math.round(cy+hs)], [Math.round(cx-rx*0.6), Math.round(cy)], [Math.round(cx-rx), Math.round(cy)]];
        case "up":    return [[Math.round(cx), Math.round(cy+ry)], [Math.round(cx), Math.round(cy-ry*0.6)], [Math.round(cx-hs), Math.round(cy-ry*0.6+hs)], [Math.round(cx), Math.round(cy-ry*0.6)], [Math.round(cx+hs), Math.round(cy-ry*0.6+hs)], [Math.round(cx), Math.round(cy-ry*0.6)], [Math.round(cx), Math.round(cy-ry)]];
        case "down":  return [[Math.round(cx), Math.round(cy-ry)], [Math.round(cx), Math.round(cy+ry*0.6)], [Math.round(cx-hs), Math.round(cy+ry*0.6-hs)], [Math.round(cx), Math.round(cy+ry*0.6)], [Math.round(cx+hs), Math.round(cy+ry*0.6-hs)], [Math.round(cx), Math.round(cy+ry*0.6)], [Math.round(cx), Math.round(cy+ry)]];
        default:      return [[Math.round(cx-rx), Math.round(cy)], [Math.round(cx+rx), Math.round(cy)]];
    }
}

function generateCrossPoints(cx, cy, rx, ry) {
    return [[Math.round(cx-rx), Math.round(cy)], [Math.round(cx+rx), Math.round(cy)], [Math.round(cx), Math.round(cy-ry)], [Math.round(cx), Math.round(cy+ry)]];
}

function generateStarPoints(cx, cy, rx, ry, numTips) {
    var points = [];
    for (var i = 0; i <= numTips * 2; i++) {
        var angle = (Math.PI * i) / numTips - Math.PI / 2;
        var r = (i % 2 === 0) ? 1.0 : 0.4;
        points.push([
            Math.round(cx + rx * r * Math.cos(angle)),
            Math.round(cy + ry * r * Math.sin(angle))
        ]);
    }
    points.push([points[0][0], points[0][1]]);
    return points;
}

function generateHighlightPoints(cx, cy, rx, lineHalfHeight) {
    return [
        [Math.round(cx - rx), Math.round(cy - lineHalfHeight)],
        [Math.round(cx + rx), Math.round(cy - lineHalfHeight)],
        [Math.round(cx + rx), Math.round(cy + lineHalfHeight)],
        [Math.round(cx - rx), Math.round(cy + lineHalfHeight)],
        [Math.round(cx - rx), Math.round(cy - lineHalfHeight)]
    ];
}

function generateSpiralPoints(cx, cy, rx, ry, numPoints) {
    var points = [];
    for (var i = 0; i <= numPoints; i++) {
        var t = i / numPoints;
        var angle = t * 4 * Math.PI;
        var r = t * 0.5 + 0.1;
        points.push([
            Math.round(cx + rx * r * Math.cos(angle)),
            Math.round(cy + ry * r * Math.sin(angle))
        ]);
    }
    return points;
}

function generateHeartPoints(cx, cy, rx, ry, numPoints) {
    var points = [];
    for (var i = 0; i <= numPoints; i++) {
        var t = (i / numPoints) * 2 * Math.PI;
        var x = 16 * Math.pow(Math.sin(t), 3);
        var y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        points.push([
            Math.round(cx + rx * x / 17),
            Math.round(cy + ry * y / 17)
        ]);
    }
    return points;
}

function generateTickPoints(cx, cy, rx, ry) {
    return [
        [Math.round(cx - rx * 0.5), Math.round(cy)],
        [Math.round(cx - rx * 0.1), Math.round(cy + ry * 0.4)],
        [Math.round(cx + rx * 0.5), Math.round(cy - ry * 0.4)]
    ];
}

function generateCrossMarkPoints(cx, cy, rx, ry) {
    return [
        [Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.4)],
        [Math.round(cx + rx * 0.4), Math.round(cy + ry * 0.4)],
        [Math.round(cx), Math.round(cy)],
        [Math.round(cx + rx * 0.4), Math.round(cy - ry * 0.4)],
        [Math.round(cx - rx * 0.4), Math.round(cy + ry * 0.4)]
    ];
}

function generateArcPoints(cx, cy, rx, ry, startAngle, endAngle, numPoints) {
    var points = [];
    for (var i = 0; i <= numPoints; i++) {
        var t = startAngle + (endAngle - startAngle) * (i / numPoints);
        points.push([
            Math.round(cx + rx * Math.cos(t)),
            Math.round(cy + ry * Math.sin(t))
        ]);
    }
    return points;
}
```

- [ ] **Step 2: 添加意图解析函数 `resolveBrushIntent`**

在形状生成函数之后，export行之前添加：

```javascript
function resolveBrushIntent(imageWidth, imageHeight, params) {
    var w = imageWidth;
    var h = imageHeight;
    var w3 = Math.round(w / 3);
    var w6 = Math.round(w * 2 / 3);
    var h3 = Math.round(h / 3);
    var h6 = Math.round(h * 2 / 3);

    var regionMap = {
        "left-top":       { cx: w3 / 2, cy: h3 / 2, rw: w3, rh: h3 },
        "center-top":     { cx: (w3 + w6) / 2, cy: h3 / 2, rw: w3, rh: h3 },
        "right-top":      { cx: (w6 + w) / 2, cy: h3 / 2, rw: w - w6, rh: h3 },
        "left-center":    { cx: w3 / 2, cy: (h3 + h6) / 2, rw: w3, rh: h6 - h3 },
        "center":         { cx: (w3 + w6) / 2, cy: (h3 + h6) / 2, rw: w3, rh: h6 - h3 },
        "right-center":   { cx: (w6 + w) / 2, cy: (h3 + h6) / 2, rw: w - w6, rh: h6 - h3 },
        "left-bottom":    { cx: w3 / 2, cy: (h6 + h) / 2, rw: w3, rh: h - h6 },
        "center-bottom":  { cx: (w3 + w6) / 2, cy: (h6 + h) / 2, rw: w3, rh: h - h6 },
        "right-bottom":   { cx: (w6 + w) / 2, cy: (h6 + h) / 2, rw: w - w6, rh: h - h6 },
        "full":           { cx: w / 2, cy: h / 2, rw: w, rh: h }
    };

    var region = regionMap[params.region];
    if (!region) {
        return { success: false, error: "未知区域: " + params.region };
    }

    var ratio = params.size_ratio !== undefined ? params.size_ratio : 0.5;
    if (ratio < 0.1) ratio = 0.1;
    if (ratio > 1.0) ratio = 1.0;
    var rx = region.rw * ratio / 2;
    var ry = region.rh * ratio / 2;

    var shapeGenerators = {
        "circle": function() { return generateEllipsePoints(region.cx, region.cy, rx, ry, 36); },
        "oval": function() { return generateEllipsePoints(region.cx, region.cy, rx, ry * 0.6, 36); },
        "line-horizontal": function() { return [[Math.round(region.cx - rx), Math.round(region.cy)], [Math.round(region.cx + rx), Math.round(region.cy)]]; },
        "line-vertical": function() { return [[Math.round(region.cx), Math.round(region.cy - ry)], [Math.round(region.cx), Math.round(region.cy + ry)]]; },
        "line-diagonal": function() { return [[Math.round(region.cx - rx), Math.round(region.cy - ry)], [Math.round(region.cx + rx), Math.round(region.cy + ry)]]; },
        "wave": function() { return generateWavePoints(region.cx, region.cy, rx, ry * 0.3, 24); },
        "arrow-right": function() { return generateArrowPoints(region.cx, region.cy, rx, ry, "right"); },
        "arrow-left": function() { return generateArrowPoints(region.cx, region.cy, rx, ry, "left"); },
        "arrow-up": function() { return generateArrowPoints(region.cx, region.cy, rx, ry, "up"); },
        "arrow-down": function() { return generateArrowPoints(region.cx, region.cy, rx, ry, "down"); },
        "cross": function() { return generateCrossPoints(region.cx, region.cy, rx, ry); },
        "star": function() { return generateStarPoints(region.cx, region.cy, rx, ry, 5); },
        "smile": function() { return generateArcPoints(region.cx, region.cy + ry * 0.3, rx * 0.6, ry * 0.4, 0, Math.PI, 20); },
        "frown": function() { return generateArcPoints(region.cx, region.cy - ry * 0.3, rx * 0.6, ry * 0.4, Math.PI, 2 * Math.PI, 20); },
        "tick": function() { return generateTickPoints(region.cx, region.cy, rx, ry); },
        "cross-mark": function() { return generateCrossMarkPoints(region.cx, region.cy, rx, ry); },
        "highlight-horizontal": function() { return generateHighlightPoints(region.cx, region.cy, rx, ry * 0.15); },
        "spiral": function() { return generateSpiralPoints(region.cx, region.cy, rx, ry, 40); },
        "heart": function() { return generateHeartPoints(region.cx, region.cy, rx, ry, 36); }
    };

    var shape = params.shape;
    var generator = shapeGenerators[shape];
    if (!generator) {
        return { success: false, error: "不支持的形状: " + shape + "，支持的形状: " + Object.keys(shapeGenerators).join(', ') };
    }

    var points = generator();

    var clampedPoints = points.map(function(p) {
        return [
            Math.max(0, Math.min(w, p[0])),
            Math.max(0, Math.min(h, p[1]))
        ];
    });

    return {
        success: true,
        points: clampedPoints,
        color: params.color || '#000000',
        width: params.width || 5,
        opacity: params.opacity !== undefined ? params.opacity : 1.0,
        brush_type: params.brush_type || 'basic'
    };
}
```

- [ ] **Step 3: 更新 export 行，导出 `resolveBrushIntent`**

将：
```javascript
export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS };
```

改为：
```javascript
export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS, resolveBrushIntent };
```

- [ ] **Step 4: 提交**

```bash
git add ai-functions.js
git commit -m "feat: add shape generators and brush intent resolver"
```

---

### Task 2: 在 ai-functions.js 中添加 draw_brush_intent 函数定义和执行逻辑

**Files:**
- Modify: `ai-functions.js`

- [ ] **Step 1: 在 AI_FUNCTION_DEFINITIONS 数组中，draw_brush_stroke 定义之后，添加 draw_brush_intent 定义**

在 `draw_brush_stroke` 函数定义（第233行 `}` 之后）添加：

```javascript
    {
        name: "draw_brush_intent",
        description: "用自然语言描述笔刷绘制意图，系统自动根据图像尺寸和区域生成路径点坐标。适用于不需要精确控制坐标的场景，如'在右上角画个红色圆圈'、'中间画一条横线'、'底部加波浪线装饰'。推荐优先使用此函数而非draw_brush_stroke。",
        parameters: {
            type: "object",
            properties: {
                region: {
                    type: "string",
                    description: "绘制区域",
                    enum: ["left-top", "center-top", "right-top", "left-center", "center", "right-center", "left-bottom", "center-bottom", "right-bottom", "full"]
                },
                shape: {
                    type: "string",
                    description: "绘制形状",
                    enum: ["circle", "oval", "line-horizontal", "line-vertical", "line-diagonal", "wave", "arrow-right", "arrow-left", "arrow-up", "arrow-down", "cross", "star", "smile", "frown", "tick", "cross-mark", "highlight-horizontal", "spiral", "heart"]
                },
                color: { type: "string", description: "笔刷颜色，十六进制格式如#FF0000，默认#000000" },
                width: { type: "number", description: "笔刷宽度1-100，默认5" },
                opacity: { type: "number", description: "不透明度0.0-1.0，默认1.0" },
                brush_type: { type: "string", description: "笔刷类型", enum: ["basic", "pencil", "marker", "watercolor", "eraser"], default: "basic" },
                size_ratio: { type: "number", description: "形状大小比例(0.1-1.0)，相对于区域尺寸，0.5表示占区域一半，默认0.5" }
            },
            required: ["region", "shape"]
        }
    },
```

- [ ] **Step 2: 在 executeAiFunction 的 switch 中添加 draw_brush_intent case**

在 `case "draw_brush_stroke"` 代码块的 `break;` 之后、`case "draw_text"` 之前，添加：

```javascript
            case "draw_brush_intent": {
                var imgW = processor.get_width();
                var imgH = processor.get_height();
                var resolved = resolveBrushIntent(imgW, imgH, params);
                if (!resolved.success) {
                    return resolved;
                }
                var color = parseHexColor(resolved.color) || { r: 0, g: 0, b: 0 };
                var bWidth = resolved.width;
                var opacity = resolved.opacity;
                var a = Math.round(opacity * 255);
                var brushType = BRUSH_TYPE_MAP[resolved.brush_type] || 0;
                var intentPoints = resolved.points;
                if (!intentPoints || intentPoints.length < 2) {
                    return { success: false, error: "生成的路径点不足" };
                }
                var flatPoints = [];
                for (var i = 0; i < intentPoints.length; i++) {
                    flatPoints.push(intentPoints[i][0], intentPoints[i][1], 0.5);
                }
                if (brushType === 0 && bWidth <= 20 && intentPoints.length <= 50) {
                    var strokePoints = intentPoints.map(function(p, idx) {
                        return { x: p[0], y: p[1], pressure: 0.5, timestamp: BigInt(Date.now() + idx) };
                    });
                    processor.draw_stroke(strokePoints, color.r, color.g, color.b, a, bWidth);
                } else {
                    var pointsArray = new Float32Array(flatPoints);
                    processor.draw_stroke_array(pointsArray, color.r, color.g, color.b, a, bWidth);
                }
                processor.end_stroke();
                return { success: true, action: functionName, params: params, resolved_points: resolved.points };
            }
```

注意：这里 `return` 提前返回而不是 `break`，因为需要返回带 `resolved_points` 的结果。

- [ ] **Step 3: 在 FUNCTION_DISPLAY_NAMES 中添加映射**

```javascript
    draw_brush_intent: "智能笔刷绘制",
```

添加在 `draw_brush_stroke: "笔刷绘制",` 之后。

- [ ] **Step 4: 提交**

```bash
git add ai-functions.js
git commit -m "feat: add draw_brush_intent function definition and execution"
```

---

### Task 3: 更新 system prompt，增强笔刷相关说明

**Files:**
- Modify: `index.html` (BASE_SYSTEM_PROMPT + buildSystemPrompt)

- [ ] **Step 1: 更新 BASE_SYSTEM_PROMPT 中绘制部分**

找到 `### 绘制` 部分（约3234-3242行），替换为：

```
### 绘制

推荐优先使用意图方式绘制（自动根据图像尺寸生成坐标路径）:

- draw_brush_intent(region, shape, color, width, opacity, brush_type, size_ratio) — 智能笔刷绘制
  region: 绘制区域 left-top/center-top/right-top/left-center/center/right-center/left-bottom/center-bottom/right-bottom/full
  shape: 形状 circle/oval/line-horizontal/line-vertical/line-diagonal/wave/arrow-right/arrow-left/arrow-up/arrow-down/cross/star/smile/frown/tick/cross-mark/highlight-horizontal/spiral/heart
  color: 十六进制如#FF0000，默认#000000
  width: 笔刷宽度1-100，默认5
  opacity: 0.0-1.0，默认1.0
  brush_type: basic/pencil/marker/watercolor/eraser，默认basic
  size_ratio: 形状大小0.1-1.0，默认0.5

- draw_brush_stroke(points, color, width, opacity, brush_type) — 精确路径绘制（需手动指定坐标）
  points: [[x,y],...]路径点，坐标原点左上角，x向右y向下
  仅在需要精确控制路径时使用，一般场景推荐用draw_brush_intent

笔刷类型选择指南:
| 类型 | 效果 | 适合场景 | 推荐宽度 |
|------|------|---------|---------|
| basic | 均匀线条，边缘清晰 | 一般绘制、标注、箭头 | 3-15 |
| pencil | 细线条，略有纹理 | 素描、勾线、草稿 | 1-5 |
| marker | 半透明宽笔触，叠加深 | 荧光标注、高亮 | 10-30 |
| watercolor | 边缘柔和，有水韵扩散 | 艺术涂抹、装饰 | 5-25 |
| eraser | 用白色覆盖（橡皮擦） | 擦除已有内容 | 10-50 |

常见意图映射:
| 用户说法 | 应调用 |
| 画个圈/圆/椭圆 | draw_brush_intent(region="center", shape="circle") |
| 右上角画个红星 | draw_brush_intent(region="right-top", shape="star", color="#FF0000") |
| 底部画波浪线装饰 | draw_brush_intent(region="center-bottom", shape="wave") |
| 中间画条横线 | draw_brush_intent(region="center", shape="line-horizontal") |
| 画个对号/勾 | draw_brush_intent(region="center", shape="tick", color="#00FF00") |
| 画个叉/打叉 | draw_brush_intent(region="center", shape="cross-mark", color="#FF0000") |
| 高亮标注某区域 | draw_brush_intent(region="center", shape="highlight-horizontal", brush_type="marker") |
| 画个爱心装饰 | draw_brush_intent(region="center", shape="heart", color="#FF69B4") |
| 涂掉/打码 | draw_brush_intent(region="center", shape="highlight-horizontal", brush_type="marker", width=30) |
| 右边画个箭头 | draw_brush_intent(region="right-center", shape="arrow-right") |
```

- [ ] **Step 2: 更新 buildSystemPrompt 函数，增加九宫格区域信息**

找到 `buildSystemPrompt` 函数（约3365行），将：

```javascript
        function buildSystemPrompt() {
            let prompt = BASE_SYSTEM_PROMPT;
            if (appState.processor) {
                prompt += '\n\n当前图像尺寸: ' + appState.processor.get_width() + 'x' + appState.processor.get_height() + ' 像素。绘制和文字坐标请参考此尺寸。';
            }
```

替换为：

```javascript
        function buildSystemPrompt() {
            let prompt = BASE_SYSTEM_PROMPT;
            if (appState.processor) {
                var w = appState.processor.get_width();
                var h = appState.processor.get_height();
                var w3 = Math.round(w / 3);
                var w6 = Math.round(w * 2 / 3);
                var h3 = Math.round(h / 3);
                var h6 = Math.round(h * 2 / 3);
                prompt += '\n\n## 当前图像信息\n- 尺寸: ' + w + 'x' + h + ' 像素\n- 坐标系: 原点左上角，x向右y向下\n- 区域参考:\n  左上(0-' + w3 + ', 0-' + h3 + ') | 中上(' + w3 + '-' + w6 + ', 0-' + h3 + ') | 右上(' + w6 + '-' + w + ', 0-' + h3 + ')\n  左中(0-' + w3 + ', ' + h3 + '-' + h6 + ') | 中心(' + w3 + '-' + w6 + ', ' + h3 + '-' + h6 + ') | 右中(' + w6 + '-' + w + ', ' + h3 + '-' + h6 + ')\n  左下(0-' + w3 + ', ' + h6 + '-' + h + ') | 中下(' + w3 + '-' + w6 + ', ' + h6 + '-' + h + ') | 右下(' + w6 + '-' + w + ', ' + h6 + '-' + h + ')';
            }
```

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat: enhance system prompt with brush intent guide and grid regions"
```

---

### Task 4: 处理 draw_brush_intent 的特殊执行逻辑

**Files:**
- Modify: `index.html` (executeToolCall function)

- [ ] **Step 1: 在 executeToolCall 函数中添加 draw_brush_intent 的处理分支**

找到 `executeToolCall` 函数（约3672行），在 `smart_crop` 处理分支的 `}` 之后、`else {` 之前添加：

```javascript
            } else if (fnName === 'draw_brush_intent') {
                try {
                    var w = appState.processor.get_width();
                    var h = appState.processor.get_height();
                    var resolved = resolveBrushIntent(w, h, fnParams);
                    if (!resolved.success) {
                        return resolved;
                    }
                    var color = parseHexColor(resolved.color) || { r: 0, g: 0, b: 0 };
                    var bWidth = resolved.width;
                    var opacity = resolved.opacity;
                    var a = Math.round(opacity * 255);
                    var brushType = BRUSH_TYPE_MAP[resolved.brush_type] || 0;
                    var intentPoints = resolved.points;
                    if (!intentPoints || intentPoints.length < 2) {
                        return { success: false, error: "生成的路径点不足" };
                    }
                    var flatPoints = [];
                    for (var i = 0; i < intentPoints.length; i++) {
                        flatPoints.push(intentPoints[i][0], intentPoints[i][1], 0.5);
                    }
                    if (brushType === 0 && bWidth <= 20 && intentPoints.length <= 50) {
                        var strokePoints = intentPoints.map(function(p, idx) {
                            return { x: p[0], y: p[1], pressure: 0.5, timestamp: BigInt(Date.now() + idx) };
                        });
                        appState.processor.draw_stroke(strokePoints, color.r, color.g, color.b, a, bWidth);
                    } else {
                        var pointsArray = new Float32Array(flatPoints);
                        appState.processor.draw_stroke_array(pointsArray, color.r, color.g, color.b, a, bWidth);
                    }
                    appState.processor.end_stroke();
                    return { success: true, action: fnName, params: fnParams, resolved_points: resolved.points };
                } catch(e) {
                    return { success: false, error: e.message };
                }
```

但需要确保这里的 `parseHexColor`、`BRUSH_TYPE_MAP` 和 `resolveBrushIntent` 都可用。它们在 `ai-functions.js` 模块中，需要确认导入。

检查 `loadAiFunctions` 的导入情况：

- [ ] **Step 2: 确认 loadAiFunctions 导出 resolveBrushIntent**

找到 `loadAiFunctions` 函数（约3747行附近），确保 import 包含 `resolveBrushIntent`：

```javascript
const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS, resolveBrushIntent } = await loadAiFunctions();
```

同样需要确保 `parseHexColor` 和 `BRUSH_TYPE_MAP` 可用。查看当前代码中 `executeToolCall` 对 `draw_brush_stroke` 的处理方式 — 它直接调用 `executeAiFunction`，而 `draw_brush_intent` 也可以走同样的路径，因为我们在 Task 2 中已经在 `executeAiFunction` 的 switch 中添加了 `draw_brush_intent` case。

但 `executeToolCall` 中有特殊处理逻辑（undo/redo/circular_mask等），需要确认 `draw_brush_intent` 是否需要特殊处理。由于 `draw_brush_intent` 也可以通过 `executeAiFunction` 处理（我们在Task 2中已添加了case），所以 `executeToolCall` 中的 `else` 分支会正确走 `executeAiFunction`。

但实际上还需要让 `executeAiFunction` 中的 `draw_brush_intent` 能访问 `resolveBrushIntent`。由于两者在同一个文件中，这是自然可用的。

**所以 Step 1 改为：不需要在 executeToolCall 中添加额外分支，因为 Task 2 中已经在 executeAiFunction 的 switch 中处理了 draw_brush_intent。**

但需要确保 `parseHexColor` 在 `executeAiFunction` 中 `draw_brush_intent` case 里可用——它在同一文件的第330行定义，是文件级函数，自然可用。

- [ ] **Step 3: 确保 loadAiFunctions 导出 resolveBrushIntent**

找到类似以下行（约3747行）：

```javascript
const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS } = await loadAiFunctions();
```

改为：

```javascript
const { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS, resolveBrushIntent } = await loadAiFunctions();
```

- [ ] **Step 4: 提交**

```bash
git add index.html ai-functions.js
git commit -m "feat: integrate draw_brush_intent into tool call pipeline"
```

---

### Task 5: 验证与测试

**Files:**
- No new files, just verification

- [ ] **Step 1: 检查 ai-functions.js 导出完整性**

```bash
grep "export" ai-functions.js
```

Expected: export 行包含 `resolveBrushIntent`

- [ ] **Step 2: 检查 index.html 中 system prompt 更新**

```bash
grep "draw_brush_intent" index.html | head -5
```

Expected: 找到 system prompt 中的 draw_brush_intent 定义和映射表

- [ ] **Step 3: 检查 loadAiFunctions 导入更新**

```bash
grep "resolveBrushIntent" index.html
```

Expected: 在 loadAiFunctions 解构赋值处找到 resolveBrushIntent

- [ ] **Step 4: 用简单测试确认 JS 没有语法错误**

```bash
node -e "import('./ai-functions.js').then(m => { console.log('Exports:', Object.keys(m)); console.log('draw_brush_intent defined:', !!m.AI_FUNCTION_DEFINITIONS.find(f => f.name === 'draw_brush_intent')); const r = m.resolveBrushIntent(800, 600, {region: 'center', shape: 'circle'}); console.log('resolveBrushIntent works:', r.success, 'points count:', r.points.length); }).catch(e => console.error(e))"
```

Expected: Exports 包含 resolveBrushIntent, draw_brush_intent 定义存在, resolveBrushIntent 返回成功结果且点数合理（约37点）

- [ ] **Step 5: 最终提交检查**

```bash
git log --oneline -5
```

确认所有提交都存在。