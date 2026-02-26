🔍 WASM 图像处理库性能优化建议

  ⚠️ 高优先级优化

  1. ✅JS-Rust 边界调用过多 (src/lib.rs:915-925)
      // 当前实现：逐像素调用 Math::random()
      let r_offset = (js_sys::Math::random() * max_offset as f64) as
      u8;
      let g_offset = (js_sys::Math::random() * max_offset as f64) as
      u8;
      let b_offset = (js_sys::Math::random() * max_offset as f64) as
      u8;

    问题：每次调用 js_sys::Math::random() 都要跨越 WASM-JS
    边界，在像素循环中极其低效。

  优化建议：使用纯 Rust 随机数生成器
   use rand::Rng;
   let mut rng = rand::thread_rng();
   // 在循环外创建，循环内直接使用
   let r_offset = rng.gen_range(0..max_offset);

  2. ✅撤销操作全量重绘 (src/lib.rs:1012-1024)
      pub fn undo_stroke(&mut self) -> bool {
       if self.strokes_history.pop().is_some() {
           // 每次撤销都重新解析原始图像并重绘所有笔刷
           if let Ok(new_image) = native::open_image_from_bytes(&
      self.original_bytes) {
               for stroke in &self.strokes_history {
                   BrushRenderer::render_stroke(&mut self.image,
      stroke);
               }
           }
       }
      }

    问题：O(n) 复杂度，历史记录越长，撤销越慢。

  优化建议：
   - 使用快照机制：保存每次操作后的完整图像状态
   - 或使用增量快照：每 5-10 次操作保存一次快照

  3. ✅重复的图像克隆 (src/lib.rs:857-925)
      let mut temp_image = self.image.clone();  // 完整克隆
      photon_rs::multiple::watermark(&mut temp_image,
      &final_watermark, x, y);
      self.image = PhotonImage::new(result_bytes, ...); // 再次创建

    问题：PhotonImage::clone() 会复制整个像素数组，对大图非常昂贵。

  优化建议：使用引用或按值移动，避免不必要的克隆。

  4. ✅像素级循环未优化 (src/lib.rs:915-925)
      for y in 0..height {
       for x in 0..width {
           let mut px = img.get_pixel(x, y);  // 
      每次调用都有边界检查
           // ...
           img.put_pixel(x, y, new_px);  // 每次调用都有边界检查
       }
      }

    问题：get_pixel/put_pixel 每次都有边界检查和索引计算。

  优化建议：直接操作原始像素数组
   let pixels = img.as_mut();
   for i in (0..pixels.len()).step_by(4) {
       pixels[i] = new_r;
       pixels[i+1] = new_g;
       pixels[i+2] = new_b;
       pixels[i+3] = new_a;
   }

  📊 中优先级优化

  5. ✅未使用 SIMD 指令

    当前配置 (.cargo/config.toml)：
      rustflags = ["-C", "llvm-args=--enable-no-nans-fp-math"]

  优化建议：添加 SIMD 支持
   rustflags = [
       "-C", "llvm-args=--enable-no-nans-fp-math",
       "-C", "target-feature=+simd128"  # WebAssembly SIMD
   ]

  6. 内存分配频繁

    在 apply_color_noise_with_strength 等函数中：
   - img.into_bytes() 创建新 Vec
   - PhotonImage::new() 再次分配

  优化建议：预分配内存并复用。

  7. ✅边缘优化算法效率低 (src/lib.rs:1940-1970)
      // O(n) 嵌套循环，对每个像素采样邻域
      for y in radius..height - radius {
       for x in radius..width - radius {
           for dy in -(radius as i32)..=(radius as i32) {
               for dx in -(radius as i32)..=(radius as i32) {
                   // O(radius²) 每个像素
               }
           }
       }
      }

    优化建议：使用可分离的高斯模糊，复杂度从 O(n·r²) 降到 O(n·r)。

  💡 低优先级优化

  8. 未使用 `#[inline]`

    许多小函数（如 clamp() 调用）可以内联。

  9. String 参数传递
      pub fn apply_lightness(&mut self, level: f32, color_space: &str)

    优化建议：使用枚举代替字符串，避免运行时字符串比较。

  10. Base64 编码开销

    每次 to_base64() 都重新编码整个图像。

  优化建议：缓存 Base64 结果，仅在图像修改时更新。

---

  🎯 具体优化建议总结


  ┌────────────────────────────────────┬───────────────┬─────────┐
  │ 优化项                             │ 预期提升      │ 实施... │
  ├────────────────────────────────────┼───────────────┼─────────┤
  │ 移除 js_sys::Math::random() 循...  │ 10-50x        │ 低      │
  │ 实现快照式撤销                     │ 100x（50笔... │ 中      │
  │ 优化像素操作                       │ 2-5x          │ 中      │
  │ 启用 SIMD                          │ 1.5-4x        │ 低      │
  │ 可分离高斯模糊                     │ 2-3x          │ 中      │
  │ 使用枚举替代字符串                 │ 1.1-1.5x      │ 低      │
  └────────────────────────────────────┴───────────────┴─────────┘

  📝 立即可做的优化

   1. 修复随机数生成（10分钟）
   2. 启用 SIMD 编译选项（1分钟）
   3. 为小函数添加 `#[inline]`（30分钟）
   4. 使用枚举替代 color_space 字符串（30分钟）

✦ 需要我帮你实施这些优化吗？
