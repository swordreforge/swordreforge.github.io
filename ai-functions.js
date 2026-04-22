// ai-functions.js
// OpenAI function calling schema + execution mapping for WASM image processor

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
                level: { type: "number", description: "对比度值，范围-255到255" }
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
                level: { type: "number", description: "饱和度值，范围-1到1" }
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
        description: "调整图像色温，正值变暖偏黄橙，负值变冷偏蓝",
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
                    description: "滤镜名称",
                    enum: ["oceanic", "islands", "marine", "seagreen", "flagblue", "diamante", "liquid", "radio", "twenties", "rosetint", "mauve", "bluechrome", "vintage", "perfume", "serenity", "golden", "pastel_pink", "cali", "dramatic", "firenze", "obsidian", "lofi"]
                }
            },
            required: ["name"]
        }
    },
    {
        name: "apply_grayscale",
        description: "将图像转为灰度（黑白）",
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
                threshold: { type: "integer", description: "阈值0-255，默认128" }
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
                type: { type: "string", description: "模糊类型", enum: ["gaussian", "box"] },
                radius: { type: "number", description: "模糊半径1-20" }
            },
            required: ["type", "radius"]
        }
    },
    {
        name: "apply_vignette",
        description: "添加暗角效果（图像边缘变暗），常用于胶片感",
        parameters: {
            type: "object",
            properties: {
                intensity: { type: "number", description: "暗角强度0.0-1.0，越大越暗" },
                radius: { type: "number", description: "暗角半径0.0-1.0，越小暗角范围越大" }
            },
            required: ["intensity", "radius"]
        }
    },
    {
        name: "apply_tint",
        description: "给图像叠加色调（整体偏色）",
        parameters: {
            type: "object",
            properties: {
                r: { type: "integer", description: "红色通道0-255" },
                g: { type: "integer", description: "绿色通道0-255" },
                b: { type: "integer", description: "蓝色通道0-255" }
            },
            required: ["r", "g", "b"]
        }
    },
    {
        name: "apply_pixelate",
        description: "像素化效果（马赛克）",
        parameters: {
            type: "object",
            properties: {
                pixel_size: { type: "integer", description: "像素块大小2-50" }
            },
            required: ["pixel_size"]
        }
    },
    {
        name: "apply_noise",
        description: "添加噪点，常用于胶片颗粒感",
        parameters: {
            type: "object",
            properties: {
                strength: { type: "number", description: "噪点强度0-200" }
            },
            required: ["strength"]
        }
    },
    {
        name: "apply_oil",
        description: "油画效果",
        parameters: {
            type: "object",
            properties: {
                radius: { type: "integer", description: "油画半径1-5" },
                intensity: { type: "integer", description: "强度1-10" }
            },
            required: ["radius", "intensity"]
        }
    },
    {
        name: "apply_emboss",
        description: "浮雕效果",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_solarize",
        description: "曝光过度效果（日晒）",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_duotone",
        description: "双色调效果，将图像映射为两种颜色之间的渐变",
        parameters: {
            type: "object",
            properties: {
                r1: { type: "integer", description: "暗部红色0-255" },
                g1: { type: "integer", description: "暗部绿色0-255" },
                b1: { type: "integer", description: "暗部蓝色0-255" },
                r2: { type: "integer", description: "亮部红色0-255" },
                g2: { type: "integer", description: "亮部绿色0-255" },
                b2: { type: "integer", description: "亮部蓝色0-255" }
            },
            required: ["r1", "g1", "b1", "r2", "g2", "b2"]
        }
    },
    {
        name: "draw_brush_stroke",
        description: "用笔刷在图像上画线/涂鸦。路径点之间会自动平滑连接。笔刷类型：basic(基础画笔)、pencil(铅笔)、marker(马克笔)、watercolor(水彩笔)、eraser(橡皮擦)。注意：坐标基于图像像素坐标系，原点在左上角，x向右增大，y向下增大",
        parameters: {
            type: "object",
            properties: {
                points: {
                    type: "array",
                    description: "路径点数组，每个点为[x,y]坐标",
                    items: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 2,
                        maxItems: 2
                    },
                    minItems: 2
                },
                color: { type: "string", description: "笔刷颜色，十六进制格式如#FF0000，默认#000000" },
                width: { type: "number", description: "笔刷宽度1-100，默认5" },
                opacity: { type: "number", description: "不透明度0.0-1.0，默认1.0" },
                brush_type: { type: "string", description: "笔刷类型", enum: ["basic", "pencil", "marker", "watercolor", "eraser"], default: "basic" }
            },
            required: ["points"]
        }
    },
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
    {
        name: "draw_text",
        description: "在图像上添加文字。坐标基于图像像素坐标系，原点在左下角",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "要绘制的文字内容" },
                x: { type: "number", description: "X坐标" },
                y: { type: "number", description: "Y坐标" },
                font_size: { type: "number", description: "字号大小10-200，默认36" },
                color: { type: "string", description: "文字颜色，十六进制格式如#FFFFFF，默认#FFFFFF" },
                has_shadow: { type: "boolean", description: "是否有阴影，默认true" }
            },
            required: ["text", "x", "y"]
        }
    },
    {
        name: "rotate_image",
        description: "旋转图像",
        parameters: {
            type: "object",
            properties: {
                angle: { type: "integer", description: "旋转角度，90的倍数" }
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
                direction: { type: "string", description: "翻转方向", enum: ["horizontal", "vertical"] }
            },
            required: ["direction"]
        }
    },
    {
        name: "reset_image",
        description: "重置图像到原始状态，撤销所有修改",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "undo",
        description: "撤销上一步操作。用户说'撤销'、'回退'、'刚才的不要了'、'恢复'等时使用",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "redo",
        description: "重做上一步被撤销的操作。用户说'重做'、'恢复刚才撤销的'时使用",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "apply_circular_mask",
        description: "圆形抠图/裁剪，保留指定圆形区域内的内容，其余变为透明",
        parameters: {
            type: "object",
            properties: {
                center_x: { type: "number", description: "圆心X坐标（像素），默认为图像宽度的一半" },
                center_y: { type: "number", description: "圆心Y坐标（像素），默认为图像高度的一半" },
                radius: { type: "number", description: "圆的半径（像素），默认为图像短边的30%" },
                feather: { type: "number", description: "边缘羽化半径（像素），值越大边缘越柔和，默认2" }
            },
            required: []
        }
    },
    {
        name: "auto_crop_by_color",
        description: "根据颜色自动抠图，保留与指定颜色相近的区域，其余变为透明",
        parameters: {
            type: "object",
            properties: {
                r: { type: "integer", description: "目标颜色红色通道0-255" },
                g: { type: "integer", description: "目标颜色绿色通道0-255" },
                b: { type: "integer", description: "目标颜色蓝色通道0-255" },
                tolerance: { type: "integer", description: "颜色容差0-100，越大匹配范围越宽，默认30" },
                feather: { type: "number", description: "边缘羽化半径，默认2" }
            },
            required: ["r", "g", "b"]
        }
    },
    {
        name: "smart_crop",
        description: "智能抠图，自动检测并抠出图像中的主体（人物/物体），去除背景",
        parameters: {
            type: "object",
            properties: {
                threshold: { type: "integer", description: "边缘检测阈值，越高越严格，默认50" },
                feather: { type: "number", description: "边缘羽化半径，默认2" }
            },
            required: []
        }
    }
];

function parseHexColor(hex) {
    if (!hex || typeof hex !== 'string') return null;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length !== 6) return null;
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

const BRUSH_TYPE_MAP = {
    basic: 0,
    pencil: 1,
    marker: 2,
    watercolor: 3,
    eraser: 4
};

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
                processor.apply_threshold(params.threshold || 128);
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
            case "apply_vignette":
                processor.apply_vignette(
                    params.intensity !== undefined ? params.intensity : 0.5,
                    params.radius !== undefined ? params.radius : 0.5
                );
                break;
            case "apply_tint":
                processor.apply_tint(params.r, params.g, params.b);
                break;
            case "apply_pixelate":
                processor.apply_pixelate(params.pixel_size);
                break;
            case "apply_noise":
                processor.apply_noise(params.strength);
                break;
            case "apply_oil":
                processor.apply_oil(params.radius, params.intensity);
                break;
            case "apply_emboss":
                processor.apply_emboss();
                break;
            case "apply_solarize":
                processor.apply_solarize();
                break;
            case "apply_duotone":
                processor.apply_duotone(params.r1, params.g1, params.b1, params.r2, params.g2, params.b2);
                break;
            case "draw_brush_stroke": {
                const points = params.points;
                if (!points || points.length < 2) {
                    return { success: false, error: "至少需要2个路径点" };
                }
                const color = parseHexColor(params.color || '#000000') || { r: 0, g: 0, b: 0 };
                const width = params.width || 5;
                const opacity = params.opacity !== undefined ? params.opacity : 1.0;
                const a = Math.round(opacity * 255);

                const brushType = BRUSH_TYPE_MAP[params.brush_type || 'basic'] || 0;
                const flatPoints = [];
                for (let i = 0; i < points.length; i++) {
                    flatPoints.push(points[i][0], points[i][1], 0.5);
                }

                if (brushType === 0 && width <= 20 && points.length <= 50) {
                    const strokePoints = points.map(function(p, idx) {
                        return { x: p[0], y: p[1], pressure: 0.5, timestamp: BigInt(Date.now() + idx) };
                    });
                    processor.draw_stroke(strokePoints, color.r, color.g, color.b, a, width);
                } else {
                    const pointsArray = new Float32Array(flatPoints);
                    processor.draw_stroke_array(pointsArray, color.r, color.g, color.b, a, width);
                }
                processor.end_stroke();
                break;
            }
            case "draw_brush_intent": {
                const imgW = processor.get_width();
                const imgH = processor.get_height();
                const resolved = resolveBrushIntent(imgW, imgH, params);
                if (!resolved.success) {
                    return resolved;
                }
                const intentColor = parseHexColor(resolved.color) || { r: 0, g: 0, b: 0 };
                const intentWidth = resolved.width;
                const intentOpacity = resolved.opacity;
                const intentA = Math.round(intentOpacity * 255);
                const intentBrushType = BRUSH_TYPE_MAP[resolved.brush_type] || 0;
                const intentPoints = resolved.points;
                if (!intentPoints || intentPoints.length < 2) {
                    return { success: false, error: "生成的路径点不足" };
                }
                const intentFlatPoints = [];
                for (let i = 0; i < intentPoints.length; i++) {
                    intentFlatPoints.push(intentPoints[i][0], intentPoints[i][1], 0.5);
                }
                if (intentBrushType === 0 && intentWidth <= 20 && intentPoints.length <= 50) {
                    const strokePoints = intentPoints.map(function(p, idx) {
                        return { x: p[0], y: p[1], pressure: 0.5, timestamp: BigInt(Date.now() + idx) };
                    });
                    processor.draw_stroke(strokePoints, intentColor.r, intentColor.g, intentColor.b, intentA, intentWidth);
                } else {
                    const pointsArray = new Float32Array(intentFlatPoints);
                    processor.draw_stroke_array(pointsArray, intentColor.r, intentColor.g, intentColor.b, intentA, intentWidth);
                }
                processor.end_stroke();
                return { success: true, action: functionName, params: params, resolved_points: resolved.points };
            }
            case "draw_text": {
                const textColor = parseHexColor(params.color || '#FFFFFF') || { r: 255, g: 255, b: 255 };
                const fontSize = params.font_size || 36;
                const hasShadow = params.has_shadow !== undefined ? params.has_shadow : true;
                processor.draw_text_with_font_name(
                    params.text, params.x, params.y, fontSize,
                    'sans-serif', hasShadow, textColor.r, textColor.g, textColor.b
                );
                break;
            }
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
            case "undo":
            case "redo":
            case "apply_circular_mask":
            case "auto_crop_by_color":
            case "smart_crop":
                return { success: true, action: functionName, params: params, needsSpecialHandling: true };
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
    apply_vignette: "暗角",
    apply_tint: "叠色",
    apply_pixelate: "像素化",
    apply_noise: "噪点",
    apply_oil: "油画",
    apply_emboss: "浮雕",
    apply_solarize: "曝光过度",
    apply_duotone: "双色调",
    draw_brush_stroke: "笔刷绘制",
    draw_brush_intent: "智能笔刷绘制",
    draw_text: "添加文字",
    rotate_image: "旋转",
    flip_image: "翻转",
    reset_image: "重置",
    undo: "撤销",
    redo: "重做",
    apply_circular_mask: "圆形抠图",
    auto_crop_by_color: "颜色抠图",
    smart_crop: "智能抠图"
};

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

function resolveBrushIntent(imageWidth, imageHeight, params) {
    var w = imageWidth;
    var h = imageHeight;
    var w3 = Math.round(w / 3);
    var w6 = Math.round(w * 2 / 3);
    var h3 = Math.round(h / 3);
    var h6 = Math.round(h * 2 / 3);

    var regionMap = {
        "left-top":       { cx: w3 / 2, cy: h3 / 2, rw: w3, rh: h3 },
        "center-top":     { cx: (w3 + w6) / 2, cy: h3 / 2, rw: w6 - w3, rh: h3 },
        "right-top":      { cx: (w6 + w) / 2, cy: h3 / 2, rw: w - w6, rh: h3 },
        "left-center":    { cx: w3 / 2, cy: (h3 + h6) / 2, rw: w3, rh: h6 - h3 },
        "center":         { cx: (w3 + w6) / 2, cy: (h3 + h6) / 2, rw: w6 - w3, rh: h6 - h3 },
        "right-center":   { cx: (w6 + w) / 2, cy: (h3 + h6) / 2, rw: w - w6, rh: h6 - h3 },
        "left-bottom":    { cx: w3 / 2, cy: (h6 + h) / 2, rw: w3, rh: h - h6 },
        "center-bottom":  { cx: (w3 + w6) / 2, cy: (h6 + h) / 2, rw: w6 - w3, rh: h - h6 },
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

export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES, RISKY_FUNCTIONS, resolveBrushIntent };