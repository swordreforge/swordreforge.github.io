根据 photon-wasm 文档，以下是可以在无级调节中添加的更多参数：

  可添加的无级调节参数

  📊 色彩校正类（已实现部分）
   1. ✅ 亮度 - 已实现
   2. ✅ 对比度 - 已实现
   3. ✅ 饱和度 - 已实现
   4. ✅ 色相 - 已实现
   5. ✅🆕 伽马校正 - gamma_correction(red, green, blue) - 分别调整 RGB
      通道的伽马值

  🌅 明暗调节类
   6. ✅🆕 明度 - lighten_hsl(level) / darken_hsl(level) - 在 HSL
      色彩空间中调整明度（参数范围 0-1）
   7. ✅🆕 明度 - lighten_lch(level) / darken_lch(level) - 在 LCh
      色彩空间中调整明度
   8. ✅🆕 明度 - lighten_hsv(level) / darken_hsv(level) - 在 HSV
      色彩空间中调整明度
   9. ✅🆕 明度 - lighten_hsluv(level) / darken_hsluv(level) - 在 HSLuv
      色彩空间中调整明度

  🔧 锐化和模糊类
   10. ✅🆕 锐化 - sharpen() - 增强图像锐度（开关式，无参数)这个点可以体
   11. 🆕 降噪 - noise_reduction() - 减少图像噪点（开关式，无参数）

  🌫️ 噪点类
   12. 🆕 随机噪点 - add_noise_rand() -
       添加随机高斯噪点（开关式，无参数）

  📝 建议添加的优先级

  高优先级（常用功能）：
   - 明度调节 - 用户最常需要的功能之一
   - 伽马校正 - 专业图像处理必备
   - 锐化 - 增强图像清晰度

  中优先级（进阶功能）：
   - 降噪 - 改善图像质量
   - 随机噪点 - 创建特殊效果

  低优先级（特殊效果）：
   - 不同色彩空间的明度调节（LCh、HSV、HSLuv）

✦ 是否需要我为这些功能添加无级调节支持？
