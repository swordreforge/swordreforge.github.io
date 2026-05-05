// AI 人像抠图模块 - 使用 MODNet ONNX 模型
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.mjs';

const REF_SIZE = 512;

class AiMatting {
    constructor() {
        this.session = null;
        this.modelUrl = 'models/modnet-int8/model.onnx';
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        // 配置 WASM 路径（使用 CDN 加载）
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';

        this.session = await ort.InferenceSession.create(this.modelUrl, {
            executionProviders: ['wasm'],
        });
        this.loaded = true;
    }

    /**
     * 对图片进行抠图处理
     * @param {ImageData} imageData - 原始图片像素数据 (RGBA)
     * @param {Function} onProgress - 进度回调 (0-100)
     * @returns {ImageData} 带透明通道的图片数据
     */
    async process(imageData, onProgress) {
        await this.load();

        const width = imageData.width;
        const height = imageData.height;

        // 小图直接处理，大图分块处理
        if (width <= 1024 && height <= 1024) {
            return await this.processFull(imageData, onProgress);
        }

        return await this.processTiled(imageData, onProgress);
    }

    /**
     * 处理完整图片
     */
    async processFull(imageData, onProgress) {
        const width = imageData.width;
        const height = imageData.height;

        // 预处理：调整尺寸 + 归一化
        const { input, scaleX, scaleY } = this.preprocess(imageData);

        if (onProgress) onProgress(30);

        // 推理
        const tensor = new ort.Tensor('float32', input, [1, 3, input.length / 3, input.length / (3 * 1)]);
        const feeds = { input: tensor };
        const results = await this.session.run(feeds);
        let matte = results.output.data;

        if (onProgress) onProgress(70);

        // 后处理：恢复原始尺寸 + 应用 alpha 通道
        const result = this.applyMatte(imageData, matte, width, height, scaleX, scaleY);

        if (onProgress) onProgress(100);

        return result;
    }

    /**
     * 分块处理大图
     */
    async processTiled(imageData, onProgress) {
        const width = imageData.width;
        const height = imageData.height;
        const tileSize = 512;
        const overlap = 32;
        const step = tileSize - overlap;

        const tilesX = Math.ceil((width - overlap) / step);
        const tilesY = Math.ceil((height - overlap) / step);
        const totalTiles = tilesX * tilesY;
        let processedTiles = 0;

        // 创建临时 canvas 用于分块
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // 创建 matte canvas（灰度）
        const matteCanvas = document.createElement('canvas');
        matteCanvas.width = width;
        matteCanvas.height = height;
        const matteCtx = matteCanvas.getContext('2d');
        const matteData = matteCtx.createImageData(width, height);

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const tileW = Math.min(tileSize, width - x);
                const tileH = Math.min(tileSize, height - y);

                const tileImageData = tempCtx.getImageData(x, y, tileW, tileH);
                const { input } = this.preprocess(tileImageData);

                const h = Math.round(input.length / (3 * tileW * tileH) * tileH);
                const w = Math.round(input.length / (3 * h));
                const tensor = new ort.Tensor('float32', input, [1, 3, h, w]);
                const results = await this.session.run({ input: tensor });
                let tileMatte = results.output.data;

                // 将 matte 写入对应区域
                const matteGray = new Uint8Array(tileMatte.length);
                for (let i = 0; i < tileMatte.length; i++) {
                    matteGray[i] = Math.round(tileMatte[i] * 255);
                }

                // 缩放到原始 tile 尺寸
                const tempMatteCanvas = document.createElement('canvas');
                tempMatteCanvas.width = w;
                tempMatteCanvas.height = h;
                const tempMatteCtx = tempMatteCanvas.getContext('2d');
                const tempMatteData = tempMatteCtx.createImageData(w, h);
                for (let i = 0; i < matteGray.length; i++) {
                    const idx = i * 4;
                    tempMatteData.data[idx] = matteGray[i];
                    tempMatteData.data[idx + 1] = matteGray[i];
                    tempMatteData.data[idx + 2] = matteGray[i];
                    tempMatteData.data[idx + 3] = 255;
                }
                tempMatteCtx.putImageData(tempMatteData, 0, 0);

                // 缩放回 tile 尺寸
                const scaledMatteCanvas = document.createElement('canvas');
                scaledMatteCanvas.width = tileW;
                scaledMatteCanvas.height = tileH;
                const scaledMatteCtx = scaledMatteCanvas.getContext('2d');
                scaledMatteCtx.drawImage(tempMatteCanvas, 0, 0, tileW, tileH);
                const scaledMatteData = scaledMatteCtx.getImageData(0, 0, tileW, tileH);

                // 写入 matte data（带边缘羽化避免拼接痕迹）
                for (let ty = 0; ty < tileH; ty++) {
                    for (let tx = 0; tx < tileW; tx++) {
                        const dstIdx = ((y + ty) * width + (x + tx)) * 4;
                        const srcIdx = (ty * tileW + tx) * 4;
                        // 边缘区域使用渐变混合
                        const blendWeight = this.getBlendWeight(tx, ty, tileW, tileH, overlap);
                        const currentVal = matteData.data[dstIdx];
                        const newVal = scaledMatteData.data[srcIdx];
                        matteData.data[dstIdx] = Math.round(currentVal * (1 - blendWeight) + newVal * blendWeight);
                    }
                }

                processedTiles++;
                if (onProgress) {
                    onProgress(Math.round((processedTiles / totalTiles) * 80));
                }
            }
        }

        matteCtx.putImageData(matteData, 0, 0);

        // 应用 matte 到原始图片
        const result = new ImageData(width, height);
        for (let i = 0; i < width * height; i++) {
            result.data[i * 4] = imageData.data[i * 4];
            result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
            result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
            result.data[i * 4 + 3] = matteData.data[i * 4];
        }

        if (onProgress) onProgress(100);

        return result;
    }

    /**
     * 获取边缘混合权重（避免分块拼接痕迹）
     */
    getBlendWeight(tx, ty, tileW, tileH, overlap) {
        const edgeDist = Math.min(tx, ty, tileW - 1 - tx, tileH - 1 - ty);
        if (edgeDist >= overlap) return 1.0;
        // 边缘区域使用平滑过渡
        const t = edgeDist / overlap;
        return t * t * (3 - 2 * t); // smoothstep
    }

    /**
     * 预处理图片：调整尺寸 + 归一化到 [-1, 1]
     */
    preprocess(imageData) {
        const width = imageData.width;
        const height = imageData.height;

        // 计算缩放比例
        const { scaleX, scaleY, newW, newH } = this.getResizeParams(width, height);

        // 缩放图片
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newW;
        tempCanvas.height = newH;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(imageData, 0, 0, newW, newH);
        const scaledData = tempCtx.getImageData(0, 0, newW, newH);

        // 归一化到 [-1, 1] 并转换为 CHW 格式
        const pixels = newW * newH;
        const input = new Float32Array(pixels * 3);

        for (let i = 0; i < pixels; i++) {
            const srcIdx = i * 4;
            input[i] = (scaledData.data[srcIdx] - 127.5) / 127.5;           // R
            input[pixels + i] = (scaledData.data[srcIdx + 1] - 127.5) / 127.5; // G
            input[pixels * 2 + i] = (scaledData.data[srcIdx + 2] - 127.5) / 127.5; // B
        }

        return { input, scaleX, scaleY, newW, newH };
    }

    /**
     * 计算缩放参数
     */
    getResizeParams(imW, imH) {
        let newW, newH;

        if (Math.max(imW, imH) < REF_SIZE || Math.min(imW, imH) > REF_SIZE) {
            if (imW >= imH) {
                newH = REF_SIZE;
                newW = Math.round((imW / imH) * REF_SIZE);
            } else {
                newW = REF_SIZE;
                newH = Math.round((imH / imW) * REF_SIZE);
            }
        } else {
            newW = imW;
            newH = imH;
        }

        // 确保尺寸能被 32 整除
        newW = newW - (newW % 32);
        newH = newH - (newH % 32);

        // 最小尺寸保护
        if (newW < 32) newW = 32;
        if (newH < 32) newH = 32;

        const scaleX = newW / imW;
        const scaleY = newH / imH;

        return { scaleX, scaleY, newW, newH };
    }

    /**
     * 应用 matte 到原始图片
     */
    applyMatte(imageData, matte, origW, origH, scaleX, scaleY) {
        // 将 matte 恢复为原始尺寸
        const matteCanvas = document.createElement('canvas');
        const matteW = Math.round(matte.length ** 0.5);
        const matteH = Math.round(matte.length / matteW);
        matteCanvas.width = matteW;
        matteCanvas.height = matteH;
        const matteCtx = matteCanvas.getContext('2d');
        const matteImgData = matteCtx.createImageData(matteW, matteH);

        for (let i = 0; i < matte.length; i++) {
            const val = Math.round(matte[i] * 255);
            const idx = i * 4;
            matteImgData.data[idx] = val;
            matteImgData.data[idx + 1] = val;
            matteImgData.data[idx + 2] = val;
            matteImgData.data[idx + 3] = 255;
        }
        matteCtx.putImageData(matteImgData, 0, 0);

        // 缩放到原始尺寸
        const scaledMatteCanvas = document.createElement('canvas');
        scaledMatteCanvas.width = origW;
        scaledMatteCanvas.height = origH;
        const scaledCtx = scaledMatteCanvas.getContext('2d');
        scaledCtx.drawImage(matteCanvas, 0, 0, origW, origH);
        const scaledMatte = scaledCtx.getImageData(0, 0, origW, origH);

        // 应用 alpha 通道
        const result = new ImageData(origW, origH);
        for (let i = 0; i < origW * origH; i++) {
            result.data[i * 4] = imageData.data[i * 4];
            result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
            result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
            result.data[i * 4 + 3] = scaledMatte.data[i * 4];
        }

        return result;
    }

    dispose() {
        if (this.session) {
            this.session.release();
            this.loaded = false;
        }
    }
}

export default AiMatting;
