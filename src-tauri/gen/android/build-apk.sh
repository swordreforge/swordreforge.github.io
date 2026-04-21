#!/bin/bash
# 使用系统 Gradle 构建 APK

cd "$(dirname "$0")"

echo "使用系统 Gradle $(gradle --version | head -1) 构建..."

# 使用系统的 gradle 命令构建
gradle assembleDebug

echo "构建完成！"
echo "APK 位置: app/build/outputs/apk/debug/app-debug.apk"