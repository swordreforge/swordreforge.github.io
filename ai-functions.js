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
                    enum: ["oceanic", "islands", "marine", "seagreen", "flagblue", "diamante", "liquid", "water", "freshblue", "lofi", "vintage", "dramatic", "amber", "lavender", "rosetint", "hometown", "fragole", "sindoni", "golden", "pastelpink", "coffee", "perfume", "bipo"]
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
    reset_image: "重置"
};

export { AI_FUNCTION_DEFINITIONS, executeAiFunction, FUNCTION_DISPLAY_NAMES };