#!/bin/bash
# 构建 Release APK 并确保 4 字节对齐

cd "$(dirname "$0")"

echo "使用系统 Gradle $(gradle --version | head -1) 构建 Release 版本..."

# 清理之前的构建
echo "清理之前的构建..."
gradle clean

# 构建 Release APK（gradle 会自动进行 zipAlign）
echo "构建 Release APK..."
gradle assembleRelease

# 检查构建结果
if [ $? -eq 0 ]; then
    echo "✓ 构建成功！"
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    ALIGNED_PATH="app/build/outputs/apk/release/app-release-aligned.apk"

    if [ -f "$APK_PATH" ]; then
        echo "APK 位置: $APK_PATH"

        # 验证 APK 对齐
        echo ""
        echo "验证 APK 对齐..."
        if command -v zipalign &> /dev/null; then
            zipalign -v -c 4 "$APK_PATH"
            if [ $? -eq 0 ]; then
                echo "✓ APK 已正确对齐（4字节边界）"
            else
                echo "✗ APK 对齐检查失败，手动重新对齐..."
                zipalign -v -p 4 "$APK_PATH" "$ALIGNED_PATH"
                if [ $? -eq 0 ]; then
                    echo "✓ 手动对齐成功: $ALIGNED_PATH"
                fi
            fi
        else
            echo "⚠ 未找到 zipalign 工具，跳过对齐验证"
        fi

        # 验证签名
        echo ""
        echo "验证 APK 签名..."
        if command -v apksigner &> /dev/null; then
            apksigner verify --verbose "$APK_PATH"
            if [ $? -eq 0 ]; then
                echo "✓ APK 签名验证通过"
            else
                echo "✗ APK 签名验证失败"
            fi
        else
            echo "⚠ 未找到 apksigner 工具，跳过签名验证"
        fi

        echo ""
        echo "APK 信息:"
        echo "  文件大小: $(du -h "$APK_PATH" | cut -f1)"
        ls -lh "$APK_PATH"
    else
        echo "✗ 未找到生成的 APK 文件"
        exit 1
    fi
else
    echo "✗ 构建失败"
    exit 1
fi