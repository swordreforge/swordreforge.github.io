@echo off
REM NCNN增强模块构建脚本 (Windows)

setlocal enabledelayedexpansion

echo ========================================
echo NCNN AI增强模块 - WebAssembly构建
echo ========================================
echo.

REM 检查Emscripten环境
if "%EMSDK%"=="" (
    echo 错误: Emscripten环境未设置
    echo 请先运行: C:\path\to\emsdk\emsdk_env.bat
    exit /b 1
)

echo Emscripten路径: %EMSDK%
echo.

REM 检查ncnn库
set NCNN_ROOT=..\ncnn-20260113-webassembly\basic
if not exist "%NCNN_ROOT%" (
    echo 错误: 找不到ncnn库
    echo 预期路径: %NCNN_ROOT%
    exit /b 1
)

echo 找到ncnn库: %NCNN_ROOT%
echo.

REM 创建构建目录
set BUILD_DIR=build
echo 创建构建目录: %BUILD_DIR%
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
cd "%BUILD_DIR%"

REM 配置CMake
echo 配置CMake...
set EMSCRIPTEN_TOOLCHAIN=%EMSDK%\upstream\emscripten\cmake\Modules\Platform\Emscripten.cmake

cmake ^
    -DCMAKE_TOOLCHAIN_FILE="%EMSCRIPTEN_TOOLCHAIN%" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DEMSCRIPTEN_ROOT="%EMSDK%" ^
    -G "MinGW Makefiles" ^
    ..

if %ERRORLEVEL% neq 0 (
    echo 错误: CMake配置失败
    exit /b 1
)

echo.
echo 开始编译...
echo ========================================

REM 编译
cmake --build . -j %NUMBER_OF_PROCESSORS%

if %ERRORLEVEL% neq 0 (
    echo 错误: 编译失败
    exit /b 1
)

echo.
echo ========================================
echo 编译成功!
echo ========================================
echo.

REM 查找生成的文件
echo 生成的文件:
for %%f in (*.js *.wasm) do (
    if exist "%%f" (
        echo   - %%f
    )
)

echo.
echo 复制文件到pkg目录...
set PKG_DIR=..\pkg
if not exist "%PKG_DIR%" mkdir "%PKG_DIR%"
copy /Y *.js "%PKG_DIR%\" >nul 2>&1
copy /Y *.wasm "%PKG_DIR%\" >nul 2>&1

echo.
echo 构建完成!
echo 输出目录: %PKG_DIR%

endlocal