#!/bin/bash
# Android 应用构建脚本

cd /home/swordreforge/project/wasm-test/src-tauri/gen/android

echo "开始构建 Android 应用..."

# 同步前端文件到 assets
echo "同步前端文件..."
cd /home/swordreforge/project/wasm-test
cp index.html src-tauri/gen/android/app/src/main/assets/
cp sw-merged.js src-tauri/gen/android/app/src/main/assets/

# 构建 APK
echo "构建 APK..."
cd /home/swordreforge/project/wasm-test/src-tauri/gen/android
./gradlew assembleDebug

echo "构建完成！"
echo "APK 位置: app/build/outputs/apk/debug/app-debug.apk"
