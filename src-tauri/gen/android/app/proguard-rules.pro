# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ========== 安全加固规则 ==========

# 不打印警告
-ignorewarnings

# 不跳过非公共库类的成员
-dontskipnonpubliclibraryclassmembers

# 优化时假设不混淆
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses

# 预校验
-dontpreverify
-verbose

# 优化选项
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# 保持混淆后的行号信息，便于崩溃跟踪
-keepattributes SourceFile,LineNumberTable

# 保持注解
-keepattributes *Annotation*

# 保持泛型和签名
-keepattributes Signature
-keepattributes EnclosingMethod

# 防止反编译：不保留源文件名
-renamesourcefileattribute SourceFile

# ========== WebView相关 ==========

# Keep WebView
-keep class android.webkit.** { *; }
-keep class * extends android.webkit.WebViewClient
-keep class * extends android.webkit.WebChromeClient

# Keep JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WASM
-keepclassmembers class * {
    native <methods>;
}

# ========== 防止反射和序列化攻击 ==========

# 序列化
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Parcelable
-keep class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator *;
}

# ========== 防止日志泄露 ==========

# 移除日志
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
    public static int wtf(...);
}

# 移除Timber日志（如果使用）
-assumenosideeffects class timber.log.Timber {
    public static void d(...);
    public static void v(...);
    public static void i(...);
    public static void w(...);
    public static void e(...);
}