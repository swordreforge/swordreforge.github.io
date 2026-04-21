#!/bin/bash

# NCNN增强模块构建脚本 (Linux/macOS)

set -e  # 遇到错误时退出

echo "========================================"
echo "NCNN AI增强模块 - WebAssembly构建"
echo "========================================"

# 检查Emscripten环境
if [ -z "$EMSDK" ]; then
    echo "错误: Emscripten环境未设置"
    echo "请先运行: source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

echo "Emscripten路径: $EMSDK"
echo ""

# 检查ncnn库
NCNN_ROOT="../ncnn-20260113-webassembly/basic"
if [ ! -d "$NCNN_ROOT" ]; then
    echo "错误: 找不到ncnn库"
    echo "预期路径: $NCNN_ROOT"
    exit 1
fi

echo "找到ncnn库: $NCNN_ROOT"
echo ""

# 创建构建目录
BUILD_DIR="build"
echo "创建构建目录: $BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# 配置CMake
echo "配置CMake..."
EMSCRIPTEN_TOOLCHAIN="$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"

cmake \
    -DCMAKE_TOOLCHAIN_FILE="$EMSCRIPTEN_TOOLCHAIN" \
    -DCMAKE_BUILD_TYPE=Release \
    -DEMSCRIPTEN_ROOT="$EMSDK" \
    ..

if [ $? -ne 0 ]; then
    echo "错误: CMake配置失败"
    exit 1
fi

echo ""
echo "开始编译..."
echo "========================================"

# 编译
cmake --build . -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

if [ $? -ne 0 ]; then
    echo "错误: 编译失败"
    exit 1
fi

echo ""
echo "========================================"
echo "编译成功!"
echo "========================================"
echo ""

# 查找生成的文件
echo "生成的文件:"
for file in *.js *.wasm 2>/dev/null; do
    if [ -f "$file" ]; then
        SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        echo "  - $file ($(echo "scale=2; $SIZE/1024" | bc) KB)"
    fi
done

echo ""
echo "复制文件到pkg目录..."
PKG_DIR="../pkg"
mkdir -p "$PKG_DIR"
cp -f *.js *.wasm "$PKG_DIR/" 2>/dev/null || true

echo ""
echo "构建完成!"
echo "输出目录: $PKG_DIR"