cmake_minimum_required(VERSION 3.10)
project(ncnn_enhance)

# 设置cmake策略以避免警告
if(POLICY CMP0177)
    cmake_policy(SET CMP0177 NEW)
endif()

# 设置C++标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找Emscripten工具链
if(DEFINED EMSCRIPTEN_ROOT)
    set(EMSCRIPTEN_TOOLCHAIN_PATH "${EMSCRIPTEN_ROOT}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake")
else()
    set(EMSCRIPTEN_TOOLCHAIN_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake")
endif()

# 检查是否在Emscripten环境中
if(DEFINED EMSCRIPTEN)
    message(STATUS "Building for WebAssembly with Emscripten")
else()
    message(FATAL_ERROR "This project must be built with Emscripten. Please source emsdk_env.sh first.")
endif()

# 设置输出目录
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../pkg)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../pkg)

# ncnn库路径
set(NCNN_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../ncnn-20260113-webassembly/basic")
set(NCNN_INCLUDE_DIR "${NCNN_ROOT}/include")
set(NCNN_LIB_DIR "${NCNN_ROOT}/lib")

# 包含ncnn头文件目录
include_directories(${NCNN_INCLUDE_DIR})

# 添加ncnn库目录
link_directories(${NCNN_LIB_DIR})

# 源文件
set(SOURCES
    ncnn_enhance.cpp
)

# 创建Wasm模块 (使用可执行文件方式)
add_executable(ncnn_enhance ${SOURCES})

# Emscripten编译选项
target_compile_options(ncnn_enhance PRIVATE
    -fexceptions
    -fpermissive
    -Wall
    -Wextra
)

# 链接选项
target_link_options(ncnn_enhance PRIVATE
    -s WASM=1
    -s ALLOW_MEMORY_GROWTH=1
    -s MALLOC=emmalloc
    -s MODULARIZE=1
    -s EXPORT_NAME="NcnnEnhance"
    -s USE_PTHREADS=0
    -s ENVIRONMENT=web
    -s MIN_CHROME_VERSION=90
    -s NO_EXIT_RUNTIME=1
    -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","setValue","getValue","UTF8ToString","stringToUTF8","lengthBytesUTF8","allocate","allocateUTF8"]'
    -s MAX_WEBGL_VERSION=2
    -s WEBGL2_BACKWARDS_COMPATIBILITY_ASSERT=0
    --bind
    -L${NCNN_LIB_DIR}
    -lncnn
    -s EXPORT_ES6=1
)

# 输出类型设置
set_target_properties(ncnn_enhance PROPERTIES
    SUFFIX ".js"
    POSITION_INDEPENDENT_CODE ON
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# 确保链接C++标准库
target_link_libraries(ncnn_enhance PRIVATE
    ncnn
)

# 自定义目标来生成最终的JavaScript绑定
add_custom_command(
    TARGET ncnn_enhance
    POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E echo "Copying generated files to pkg directory..."
)

# 安装规则
install(TARGETS ncnn_enhance
    LIBRARY DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/../pkg
    ARCHIVE DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/../pkg
)

# 打印配置信息
message(STATUS "=================================")
message(STATUS "Build Configuration:")
message(STATUS "  Emscripten Root: ${EMSCRIPTEN_ROOT}")
message(STATUS "  ncnn Root: ${NCNN_ROOT}")
message(STATUS "  Output Directory: ${CMAKE_CURRENT_SOURCE_DIR}/../pkg")
message(STATUS "=================================")