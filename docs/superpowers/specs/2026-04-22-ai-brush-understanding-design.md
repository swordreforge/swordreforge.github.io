# AI笔刷理解增强设计

## 问题

AI 调用 `draw_brush_stroke` 时生成不合理的路径坐标，原因：

1. **不知道图像尺寸** — 生成的坐标越界或不合理
2. **不知道图像内容** — 无法根据内容定位（如"在脸上画圈"）
3. **不理解笔刷类型效果** — 选错 brush_type / width / opacity

## 方案：两阶段增强

### 阶段一：增强 Prompt 上下文

在每次 AI 对话时注入动态 system prompt 片段，包含：

#### 1.1 图像尺寸与区域参考

```
## 当前图像信息
- 尺寸: {width}x{height} 像素
- 坐标系: 原点在左上角，x向右增大，y向下增大

区域坐标参考:
┌──────────┬──────────┬──────────┐
│ 左上      │ 中上      │ 右上      │
│ 0-{w3},{w3} │ {w3}-{w6},{w3} │ {w6}-{w},{w3} │
├──────────┼──────────┼──────────┤
│ 左中      │ 中心      │ 右中      │
│ 0-{w3},{w3}-{h6} │ {w3}-{w6},{w3}-{h6} │ {w6}-{w},{h3}-{h6} │
├──────────┼──────────┼──────────┤
│ 左下      │ 中下      │ 右下      │
│ 0-{w3},{h6}-{h} │ {w3}-{w6},{h6}-{h} │ {w6}-{w},{h6}-{h} │
└──────────┴──────────┴──────────┘
```

其中 `w3=width/3`, `w6=width*2/3`, `h3=height/3`, `h6=height*2/3`

#### 1.2 笔刷类型效果参考表

```
笔刷类型选择指南:
| 类型 | 效果 | 适合场景 | 推荐宽度 |
|------|------|---------|---------|
| basic | 均匀线条，边缘清晰 | 一般绘制、标注、箭头 | 3-15 |
| pencil | 细线条，略有纹理 | 素描、勾线、草稿 | 1-5 |
| marker | 半透明宽笔触，叠加深 | 荧光标注、高亮 | 10-30 |
| watercolor | 边缘柔和，有水韵扩散 | 艺术涂抹、装饰 | 5-25 |
| eraser | 用白色覆盖（橡皮擦） | 擦除已有内容 | 10-50 |
```

#### 1.3 路径生成指南

```
路径生成建议:
- 画圆/椭圆: 生成20-40个均匀分布的点，半径建议用图像短边的5%-15%
- 画直线: 起点和终点2个点即可
- 画波浪线: 沿主方向每隔短边2%-3%生成一个点，y值波动±短边3%-5%
- 画箭头: 主线2点 + 箭头头部2-3点（V字形）
- 涂抹/高亮: 在目标区域内密集生成路径点
- 避免坐标超出 [0, width] x [0, height] 范围
```

### 阶段二：自然语言意图解析层

新增 `draw_brush_intent` 函数，AI 用自然语言描述意图，前端自动生成坐标。

#### 2.1 函数定义

```javascript
{
    name: "draw_brush_intent",
    description: "用自然语言描述笔刷绘制意图。适用于不需要精确坐标的场景，系统会根据图像尺寸和区域自动生成路径。例如：'在右上角画一个红色圆圈'、'中间画一条横线'、'底部加波浪线装饰'",
    parameters: {
        type: "object",
        properties: {
            region: {
                type: "string",
                description: "绘制区域",
                enum: [
                    "left-top", "center-top", "right-top",
                    "left-center", "center", "right-center",
                    "left-bottom", "center-bottom", "right-bottom",
                    "full"
                ]
            },
            shape: {
                type: "string",
                description: "绘制形状",
                enum: ["circle", "oval", "line-horizontal", "line-vertical", "line-diagonal", 
                       "wave", "arrow-right", "arrow-left", "arrow-up", "arrow-down",
                       "cross", "star", "smile", "frown", "tick", "cross-mark",
                       "highlight-horizontal", "spiral", "heart", "freeform"]
            },
            color: {
                type: "string",
                description: "笔刷颜色，十六进制格式如#FF0000，默认#000000"
            },
            width: {
                type: "number",
                description: "笔刷宽度1-100，默认5"
            },
            opacity: {
                type: "number",
                description: "不透明度0.0-1.0，默认1.0"
            },
            brush_type: {
                type: "string",
                description: "笔刷类型",
                enum: ["basic", "pencil", "marker", "watercolor", "eraser"],
                default: "basic"
            },
            size_ratio: {
                type: "number",
                description: "形状大小比例，相对于区域尺寸，0.1-1.0，默认0.5"
            }
        },
        required: ["region", "shape"]
    }
}
```

#### 2.2 意图解析器实现

```javascript
function resolveBrushIntent(imageWidth, imageHeight, params) {
    const regionMap = {
        "left-top":       { cx: width * 1/6, cy: height * 1/6, w: width/3, h: height/3 },
        "center-top":     { cx: width * 1/2, cy: height * 1/6, w: width/3, h: height/3 },
        "right-top":      { cx: width * 5/6, cy: height * 1/6, w: width/3, h: height/3 },
        "left-center":    { cx: width * 1/6, cy: height * 1/2, w: width/3, h: height/3 },
        "center":         { cx: width * 1/2, cy: height * 1/2, w: width/3, h: height/3 },
        "right-center":   { cx: width * 5/6, cy: height * 1/2, w: width/3, h: height/3 },
        "left-bottom":    { cx: width * 1/6, cy: height * 5/6, w: width/3, h: height/3 },
        "center-bottom":  { cx: width * 1/2, cy: height * 5/6, w: width/3, h: height/3 },
        "right-bottom":   { cx: width * 5/6, cy: height * 5/6, w: width/3, h: height/3 },
        "full":           { cx: width * 1/2, cy: height * 1/2, w: width, h: height }
    };
    
    const region = regionMap[params.region];
    const ratio = params.size_ratio || 0.5;
    const rx = region.w * ratio / 2;  // x方向半径
    const ry = region.h * ratio / 2;  // y方向半径
    
    // 形状生成器
    const shapeGenerators = {
        "circle": (cx, cy, rx, ry) => generateEllipsePoints(cx, cy, rx, ry, 36),
        "oval": (cx, cy, rx, ry) => generateEllipsePoints(cx, cy, rx, ry * 0.6, 36),
        "line-horizontal": (cx, cy, rx, ry) => [[cx-rx, cy], [cx+rx, cy]],
        "line-vertical": (cx, cy, rx, ry) => [[cx, cy-ry], [cx, cy+ry]],
        "line-diagonal": (cx, cy, rx, ry) => [[cx-rx, cy-ry], [cx+rx, cy+ry]],
        "wave": (cx, cy, rx, ry) => generateWavePoints(cx, cy, rx, ry * 0.3, 24),
        "arrow-right": (cx, cy, rx, ry) => generateArrowPoints(cx, cy, rx, ry, "right"),
        "arrow-left": (cx, cy, rx, ry) => generateArrowPoints(cx, cy, rx, ry, "left"),
        "arrow-up": (cx, cy, rx, ry) => generateArrowPoints(cx, cy, rx, ry, "up"),
        "arrow-down": (cx, cy, rx, ry) => generateArrowPoints(cx, cy, rx, ry, "down"),
        "cross": (cx, cy, rx, ry) => generateCrossPoints(cx, cy, rx, ry),
        "star": (cx, cy, rx, ry) => generateStarPoints(cx, cy, rx, ry, 5),
        "smile": (cx, cy, rx, ry) => generateArcPoints(cx, cy + ry*0.3, rx*0.6, ry*0.4, 0, Math.PI, 20),
        "frown": (cx, cy, rx, ry) => generateArcPoints(cx, cy - ry*0.3, rx*0.6, ry*0.4, Math.PI, 2*Math.PI, 20),
        "tick": (cx, cy, rx, ry) => generateTickPoints(cx, cy, rx, ry),
        "cross-mark": (cx, cy, rx, ry) => generateCrossMarkPoints(cx, cy, rx, ry),
        "highlight-horizontal": (cx, cy, rx, ry) => generateHighlightPoints(cx, cy, rx, ry * 0.15),
        "spiral": (cx, cy, rx, ry) => generateSpiralPoints(cx, cy, rx, ry, 40),
        "heart": (cx, cy, rx, ry) => generateHeartPoints(cx, cy, rx, ry, 36),
        "freeform": null // freeform 需要 AI 提供额外 points 参数
    };
    
    // 生成点阵
    const generator = shapeGenerators[params.shape];
    if (!generator) {
        return { success: false, error: "不支持的形状或需要手动指定路径" };
    }
    
    const points = generator(region.cx, region.cy, rx, ry);
    
    // clamp 坐标到图像范围
    const clampedPoints = points.map(([x, y]) => [
        Math.max(0, Math.min(imageWidth, Math.round(x))),
        Math.max(0, Math.min(imageHeight, Math.round(y)))
    ]);
    
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

#### 2.3 形状生成辅助函数

```javascript
function generateEllipsePoints(cx, cy, rx, ry, numPoints) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;
        points.push([
            Math.round(cx + rx * Math.cos(angle)),
            Math.round(cy + ry * Math.sin(angle))
        ]);
    }
    return points;
}

function generateWavePoints(cx, cy, rx, amplitude, numPoints) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = cx - rx + 2 * rx * t;
        const y = cy + amplitude * Math.sin(t * 4 * Math.PI);
        points.push([Math.round(x), Math.round(y)]);
    }
    return points;
}

function generateArrowPoints(cx, cy, rx, ry, direction) {
    // 箭头：主线 + 箭头头部
    const headSize = Math.min(rx, ry) * 0.4;
    switch(direction) {
        case "right": return [[cx-rx, cy], [cx+rx*0.6, cy], [cx+rx*0.6-headSize, cy-headSize], [cx+rx*0.6, cy], [cx+rx*0.6-headSize, cy+headSize], [cx+rx*0.6, cy], [cx+rx, cy]];
        case "left":  return [[cx+rx, cy], [cx-rx*0.6, cy], [cx-rx*0.6+headSize, cy-headSize], [cx-rx*0.6, cy], [cx-rx*0.6+headSize, cy+headSize], [cx-rx*0.6, cy], [cx-rx, cy]];
        case "up":    return [[cx, cy+ry], [cx, cy-ry*0.6], [cx-headSize, cy-ry*0.6+headSize], [cx, cy-ry*0.6], [cx+headSize, cy-ry*0.6+headSize], [cx, cy-ry*0.6], [cx, cy-ry]];
        case "down":  return [[cx, cy-ry], [cx, cy+ry*0.6], [cx-headSize, cy+ry*0.6-headSize], [cx, cy+ry*0.6], [cx+headSize, cy+ry*0.6-headSize], [cx, cy+ry*0.6], [cx, cy+ry]];
    }
}

function generateCrossPoints(cx, cy, rx, ry) {
    return [[cx-rx, cy], [cx+rx, cy], [cx, cy-ry], [cx, cy+ry]];
}

function generateStarPoints(cx, cy, rx, ry, numTips) {
    const points = [];
    for (let i = 0; i <= numTips * 2; i++) {
        const angle = (Math.PI * i) / numTips - Math.PI / 2;
        const r = (i % 2 === 0) ? 1.0 : 0.4;
        points.push([
            Math.round(cx + rx * r * Math.cos(angle)),
            Math.round(cy + ry * r * Math.sin(angle))
        ]);
    }
    // 闭合
    points.push(points[0]);
    return points;
}

function generateHighlightPoints(cx, cy, rx, lineHalfHeight) {
    return [
        [cx - rx, cy - lineHalfHeight],
        [cx + rx, cy - lineHalfHeight],
        [cx + rx, cy + lineHalfHeight],
        [cx - rx, cy + lineHalfHeight],
        [cx - rx, cy - lineHalfHeight]
    ];
}

function generateSpiralPoints(cx, cy, rx, ry, numPoints) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const angle = t * 4 * Math.PI;
        const r = t * 0.5 + 0.1;
        points.push([
            Math.round(cx + rx * r * Math.cos(angle)),
            Math.round(cy + ry * r * Math.sin(angle))
        ]);
    }
    return points;
}

function generateHeartPoints(cx, cy, rx, ry, numPoints) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * 2 * Math.PI;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        points.push([
            Math.round(cx + rx * x / 17),
            Math.round(cy + ry * y / 17)
        ]);
    }
    return points;
}

function generateTickPoints(cx, cy, rx, ry) {
    return [
        [cx - rx * 0.5, cy],
        [cx - rx * 0.1, cy + ry * 0.4],
        [cx + rx * 0.5, cy - ry * 0.4]
    ];
}

function generateCrossMarkPoints(cx, cy, rx, ry) {
    return [
        [cx - rx * 0.4, cy - ry * 0.4],
        [cx + rx * 0.4, cy + ry * 0.4],
        [cx, cy],
        [cx + rx * 0.4, cy - ry * 0.4],
        [cx - rx * 0.4, cy + ry * 0.4]
    ];
}
```

### 两者关系

- `draw_brush_stroke` — 原有函数，AI 提供精确坐标，适合需要完全控制路径的场景
- `draw_brush_intent` — 新增函数，AI 提供意图，前端生成坐标，适合常见绘制需求
- AI 可同时使用两个函数，根据场景自行选择
- 在 system prompt 中引导 AI：**大多数场景优先使用 `draw_brush_intent`**，只在需要精确路径时使用 `draw_brush_stroke`

### System Prompt 更新

在 `BASE_SYSTEM_PROMPT` 的绘制部分更新为：

```
### 绘制

推荐使用意图方式绘制（自动根据图像尺寸生成坐标）:

- draw_brush_intent(region, shape, color, width, opacity, brush_type, size_ratio) — 智能笔刷绘制
  region: left-top/center-top/right-top/left-center/center/right-center/left-bottom/center-bottom/right-bottom/full
  shape: circle/oval/line-horizontal/line-vertical/wave/arrow-right/.../freeform
  color: 十六进制如#FF0000，默认#000000
  width: 笔刷宽度1-100，默认5
  opacity: 0.0-1.0，默认1.0
  brush_type: basic/pencil/marker/watercolor/eraser，默认basic
  size_ratio: 形状大小0.1-1.0，默认0.5

- draw_brush_stroke(points, color, width, opacity, brush_type) — 精确路径绘制
  仅在需要完全控制路径时使用，坐标基于图像像素

笔刷类型选择:
- basic: 均匀线条，适合标注、箭头（宽3-15）
- pencil: 细线条有纹理，适合素描、勾线（宽1-5）
- marker: 半透明宽笔触，适合荧光标注、高亮（宽10-30）
- watercolor: 边缘柔和扩散，适合艺术装饰（宽5-25）
- eraser: 白色覆盖，适合擦除（宽10-50）

常见意图:
| 用户说法 | 应调用 |
| 画个圈/圆 | draw_brush_intent(region="center", shape="circle") |
| 右上角画红线 | draw_brush_intent(region="right-top", shape="circle", color="#FF0000") |
| 底部画波浪 | draw_brush_intent(region="center-bottom", shape="wave") |
| 中间划条线 | draw_brush_intent(region="center", shape="line-horizontal") |
| 涂掉/打码 | draw_brush_intent(region="center", shape="highlight-horizontal", brush_type="marker") |
| 做个标记 | draw_brush_intent(region="center", shape="tick", color="#00FF00") |
```

### 动态 Prompt 注入

在每次发送消息给 AI 时，动态拼接图像信息：

```javascript
function getImageContextPrompt() {
    if (!appState.processor) return '';
    const w = appState.processor.get_width();
    const h = appState.processor.get_height();
    const w3 = Math.round(w / 3);
    const w6 = Math.round(w * 2 / 3);
    const h3 = Math.round(h / 3);
    const h6 = Math.round(h * 2 / 3);
    
    return `
## 当前图像信息
- 尺寸: ${w}x${h} 像素
- 坐标系: 原点左上角，x向右y向下
- 区域参考:
  左上(0-${w3}, 0-${h3}) | 中上(${w3}-${w6}, 0-${h3}) | 右上(${w6}-${w}, 0-${h3})
  左中(0-${w3}, ${h3}-${h6}) | 中心(${w3}-${w6}, ${h3}-${h6}) | 右中(${w6}-${w}, ${h3}-${h6})
  左下(0-${w3}, ${h6}-${h}) | 中下(${w3}-${w6}, ${h6}-${h}) | 右下(${w6}-${w}, ${h6}-${h})`;
}
```

## 修改文件清单

1. **ai-functions.js** — 新增 `draw_brush_intent` 函数定义、意图解析逻辑、形状生成器
2. **index.html** — 更新 system prompt，注入动态图像信息；在 executeAiFunction 中处理 `draw_brush_intent` 调用
3. **index.html** — 更新 FUNCTION_DISPLAY_NAMES 和 RISKY_FUNCTIONS 映射