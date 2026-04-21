// ncnn AI 图像增强功能 - WebAssembly 版本
// 支持图像修复、超分辨率、去噪等AI功能

#include <emscripten.h>
#include <emscripten/bind.h>
#include <stdint.h>
#include <string.h>
#include <vector>
#include <string>

// ncnn 头文件
#include "ncnn/mat.h"
#include "ncnn/net.h"
#include "ncnn/option.h"

using namespace emscripten;
using namespace ncnn;

// 全局网络对象
static Net g_enhance_net;
static bool g_net_loaded = false;

// 图像增强结果结构
struct EnhanceResult {
    uint8_t* data;      // 图像数据指针
    int width;          // 宽度
    int height;         // 高度
    int channels;       // 通道数
    int success;        // 是否成功
    std::string error;  // 错误信息
};

// 图像信息结构
struct ImageInfo {
    int width;
    int height;
    int channels;
    int pixel_size;     // 每个像素的字节数
};

/**
 * 初始化ncnn网络
 * @param model_param 模型参数文件内容 (二进制数据)
 * @param param_size 参数数据大小
 * @param model_bin 模型权重文件内容 (二进制数据)
 * @param bin_size 权重数据大小
 * @return 是否初始化成功 (0=成功, 负数=错误码)
 */
EMSCRIPTEN_KEEPALIVE
int init_enhance_net(const uint8_t* model_param, int param_size, const uint8_t* model_bin, int bin_size) {
    try {
        // 创建option配置
        Option opt;
        opt.num_threads = 4;
        opt.use_vulkan_compute = false;  // WebAssembly不支持Vulkan
        opt.use_winograd_convolution = true;
        opt.use_sgemm_convolution = true;
        opt.use_int8_inference = false;
        opt.use_fp16_packed = false;
        opt.use_fp16_storage = false;
        opt.use_fp16_arithmetic = false;
        opt.use_int8_storage = false;
        opt.use_int8_arithmetic = false;
        opt.use_packing_layout = false;

        // 加载网络
        if (g_net_loaded) {
            g_enhance_net.clear();
        }

        // 配置网络选项
        g_enhance_net.opt = opt;

        // 从内存加载模型参数 (使用ncnn的二进制格式)
        int ret = g_enhance_net.load_param(model_param);
        if (ret <= 0) {
            return -1;
        }

        // 从内存加载模型权重
        ret = g_enhance_net.load_model(model_bin);
        if (ret <= 0) {
            return -2;
        }

        g_net_loaded = true;

        return 0;  // 成功
    } catch (...) {
        return -3;
    }
}

/**
 * 检查网络是否已加载
 */
EMSCRIPTEN_KEEPALIVE
bool is_net_loaded() {
    return g_net_loaded;
}

/**
 * 获取图像信息
 * @param data 图像数据
 * @param width 宽度
 * @param height 高度
 * @param channels 通道数
 * @return 图像信息
 */
EMSCRIPTEN_KEEPALIVE
ImageInfo get_image_info(const uint8_t* data, int width, int height, int channels) {
    ImageInfo info;
    info.width = width;
    info.height = height;
    info.channels = channels;
    info.pixel_size = channels;
    return info;
}

/**
 * 将RGBA图像转换为RGB
 * @param rgba_data RGBA数据
 * @param width 宽度
 * @param height 高度
 * @return RGB数据（需要调用者释放）
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* rgba_to_rgb(const uint8_t* rgba_data, int width, int height) {
    int size = width * height;
    uint8_t* rgb_data = new uint8_t[size * 3];

    for (int i = 0; i < size; i++) {
        int rgba_idx = i * 4;
        int rgb_idx = i * 3;
        rgb_data[rgb_idx] = rgba_data[rgba_idx];         // R
        rgb_data[rgb_idx + 1] = rgba_data[rgba_idx + 1]; // G
        rgb_data[rgb_idx + 2] = rgba_data[rgba_idx + 2]; // B
    }

    return rgb_data;
}

/**
 * 将RGB图像转换为RGBA
 * @param rgb_data RGB数据
 * @param width 宽度
 * @param height 高度
 * @return RGBA数据（需要调用者释放）
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* rgb_to_rgba(const uint8_t* rgb_data, int width, int height) {
    int size = width * height;
    uint8_t* rgba_data = new uint8_t[size * 4];

    for (int i = 0; i < size; i++) {
        int rgb_idx = i * 3;
        int rgba_idx = i * 4;
        rgba_data[rgba_idx] = rgb_data[rgb_idx];         // R
        rgba_data[rgba_idx + 1] = rgb_data[rgb_idx + 1]; // G
        rgba_data[rgba_idx + 2] = rgb_data[rgb_idx + 2]; // B
        rgba_data[rgba_idx + 3] = 255;                    // A
    }

    return rgba_data;
}

/**
 * AI图像增强
 * @param input_data 输入图像数据 (RGBA格式)
 * @param width 图像宽度
 * @param height 图像高度
 * @param enhance_type 增强类型 (0: 通用增强, 1: 去噪, 2: 超分辨率, 3: 锐化)
 * @return 增强结果结构
 */
EMSCRIPTEN_KEEPALIVE
EnhanceResult enhance_image(const uint8_t* input_data, int width, int height, int enhance_type) {
    EnhanceResult result;
    result.success = 0;
    result.error = "";

    if (!g_net_loaded) {
        result.error = "Network not loaded. Please call init_enhance_net first.";
        return result;
    }

    try {
        // 将RGBA转换为RGB
        uint8_t* rgb_data = rgba_to_rgb(input_data, width, height);

        // 创建ncnn Mat
        Mat img = Mat::from_pixels(rgb_data, Mat::PIXEL_RGB, width, height);

        // 归一化到0-1范围
        Mat norm_img = img.clone();
        {
            float mean_vals[3] = {0.f, 0.f, 0.f};
            float norm_vals[3] = {1.f / 255.f, 1.f / 255.f, 1.f / 255.f};
            norm_img.substract_mean_normalize(mean_vals, norm_vals);
        }

        // 创建Extractor
        Extractor ex = g_enhance_net.create_extractor();
        ex.set_light_mode(true);

        // 设置输入 (假设输入名为"input")
        ex.input("input", norm_img);

        // 根据增强类型选择不同的输出节点
        const char* output_name = "output";
        switch (enhance_type) {
            case 1:
                output_name = "denoise_output";
                break;
            case 2:
                output_name = "sr_output";
                break;
            case 3:
                output_name = "sharpen_output";
                break;
            default:
                output_name = "output";
        }

        // 获取输出
        Mat out;
        int ret = ex.extract(output_name, out);
        if (ret != 0) {
            delete[] rgb_data;
            result.error = "Failed to extract output from network.";
            return result;
        }

        // 反归一化到0-255范围
        Mat final_out = out.clone();
        {
            float mean_vals[3] = {0.f, 0.f, 0.f};
            float norm_vals[3] = {255.f, 255.f, 255.f};
            final_out.substract_mean_normalize(mean_vals, norm_vals);
        }

        // 获取输出尺寸
        int out_w = final_out.w;
        int out_h = final_out.h;

        // 转换为uint8_t数据
        std::vector<uint8_t> out_rgb(out_w * out_h * 3);
        for (int i = 0; i < out_w * out_h; i++) {
            const float* ptr = final_out.channel(0).row(i / out_w) + (i % out_w);
            out_rgb[i * 3] = (uint8_t)(ptr[0]);
            out_rgb[i * 3 + 1] = (uint8_t)(ptr[1]);
            out_rgb[i * 3 + 2] = (uint8_t)(ptr[2]);
        }

        // 转换回RGBA格式
        uint8_t* out_rgba = rgb_to_rgba(out_rgb.data(), out_w, out_h);

        // 设置结果
        result.data = out_rgba;
        result.width = out_w;
        result.height = out_h;
        result.channels = 4;
        result.success = 1;

        // 清理
        delete[] rgb_data;

    } catch (const std::exception& e) {
        result.error = std::string("Exception: ") + e.what();
    } catch (...) {
        result.error = "Unknown error occurred during image enhancement.";
    }

    return result;
}

/**
 * 简单的图像锐化处理 (不使用AI网络)
 * @param input_data 输入图像数据 (RGBA格式)
 * @param width 图像宽度
 * @param height 图像高度
 * @param strength 锐化强度 (0.0-2.0)
 * @return 锐化后的图像数据 (需要调用者释放)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* sharpen_image_simple(const uint8_t* input_data, int width, int height, float strength) {
    int size = width * height;
    uint8_t* output_data = new uint8_t[size * 4];

    // 复制原始数据
    memcpy(output_data, input_data, size * 4);

    // 简单的拉普拉斯锐化算子
    float kernel[3][3] = {
        {0, -strength, 0},
        {-strength, 1 + 4 * strength, -strength},
        {0, -strength, 0}
    };

    // 对每个通道进行卷积
    for (int c = 0; c < 3; c++) {  // RGB通道
        for (int y = 1; y < height - 1; y++) {
            for (int x = 1; x < width - 1; x++) {
                float sum = 0;
                for (int ky = -1; ky <= 1; ky++) {
                    for (int kx = -1; kx <= 1; kx++) {
                        int idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += input_data[idx] * kernel[ky + 1][kx + 1];
                    }
                }
                int out_idx = (y * width + x) * 4 + c;
                output_data[out_idx] = (uint8_t)(std::max(0, std::min(255, (int)sum)));
            }
        }
    }

    // Alpha通道保持不变
    for (int i = 0; i < size; i++) {
        output_data[i * 4 + 3] = input_data[i * 4 + 3];
    }

    return output_data;
}

/**
 * 简单的图像去噪处理 (中值滤波)
 * @param input_data 输入图像数据 (RGBA格式)
 * @param width 图像宽度
 * @param height 图像高度
 * @param kernel_size 滤波核大小 (3, 5, 7等奇数)
 * @return 去噪后的图像数据 (需要调用者释放)
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* denoise_image_simple(const uint8_t* input_data, int width, int height, int kernel_size) {
    int size = width * height;
    uint8_t* output_data = new uint8_t[size * 4];
    memcpy(output_data, input_data, size * 4);

    int half = kernel_size / 2;

    // 对每个通道进行中值滤波
    for (int c = 0; c < 3; c++) {
        for (int y = half; y < height - half; y++) {
            for (int x = half; x < width - half; x++) {
                std::vector<uint8_t> values;
                values.reserve(kernel_size * kernel_size);

                for (int ky = -half; ky <= half; ky++) {
                    for (int kx = -half; kx <= half; kx++) {
                        int idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        values.push_back(input_data[idx]);
                    }
                }

                // 计算中值
                std::sort(values.begin(), values.end());
                uint8_t median = values[values.size() / 2];

                int out_idx = (y * width + x) * 4 + c;
                output_data[out_idx] = median;
            }
        }
    }

    return output_data;
}

/**
 * 释放图像数据内存
 * @param data 图像数据指针
 */
EMSCRIPTEN_KEEPALIVE
void free_image_data(uint8_t* data) {
    if (data != nullptr) {
        delete[] data;
    }
}

/**
 * 释放增强结果内存
 * @param result 增强结果
 */
EMSCRIPTEN_KEEPALIVE
void free_enhance_result(EnhanceResult* result) {
    if (result != nullptr && result->data != nullptr) {
        delete[] result->data;
        result->data = nullptr;
    }
}

// 使用embind导出函数到JavaScript
EMSCRIPTEN_BINDINGS(ncnn_enhance) {
    value_object<ImageInfo>("ImageInfo")
        .field("width", &ImageInfo::width)
        .field("height", &ImageInfo::height)
        .field("channels", &ImageInfo::channels)
        .field("pixel_size", &ImageInfo::pixel_size);

    // 不导出EnhanceResult，因为它包含原始指针
    // 改为使用EMSCRIPTEN_KEEPALIVE函数直接返回指针

    function("init_enhance_net", &init_enhance_net, allow_raw_pointers());
    function("is_net_loaded", &is_net_loaded);
    function("get_image_info", &get_image_info, allow_raw_pointers());
    function("rgba_to_rgb", &rgba_to_rgb, allow_raw_pointers());
    function("rgb_to_rgba", &rgb_to_rgba, allow_raw_pointers());
    function("enhance_image", &enhance_image, allow_raw_pointers());
    function("sharpen_image_simple", &sharpen_image_simple, allow_raw_pointers());
    function("denoise_image_simple", &denoise_image_simple, allow_raw_pointers());
    function("free_image_data", &free_image_data, allow_raw_pointers());
    function("free_enhance_result", &free_enhance_result, allow_raw_pointers());
}