#!/bin/bash
# 使用系统已安装的 Gradle 构建脚本

cd "$(dirname "$0")"

# 使用系统的 gradle 命令
/usr/bin/gradle "$@"