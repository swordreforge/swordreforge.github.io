// AI 人像抠图模块 - 使用 MODNet ONNX 模型
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.all.min.mjs';

const REF_SIZE = 512;

class AiMatting {
    constructor() {
        this.session = null;
        this.modelUrl = 'models/modnet-fp32/model.onnx';
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
        ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

        console.log(`加载 ONNX 模型: ${this.modelUrl}`);

        try {
            this.session = await ort.InferenceSession.create(this.modelUrl, {
                executionProviders: ['webgpu', 'wasm'],
            });
            this.loaded = true;
            console.log('ONNX 模型加载成功');
        } catch (e) {
            console.error('ORT URL 加载失败，尝试 ArrayBuffer:', e);
            const response = await fetch(this.modelUrl);
            if (!response.ok) throw new Error(`无法加载模型: ${response.status}`);
            const modelBuffer = await response.arrayBuffer();
            console.log(`模型大小: ${(modelBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

            this.session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: ['webgpu', 'wasm'],
            });
            this.loaded = true;
            console.log('ONNX 模型通过 ArrayBuffer 加载成功');
        }
    }

    async process(imageData, onProgress) {
        await this.load();
        const width = imageData.width;
        const height = imageData.height;

        if (width <= 1024 && height <= 1024) {
            return await this.processFull(imageData, onProgress);
        }
        return await this.processTiled(imageData, onProgress);
    }

    async processFull(imageData, onProgress) {
        const { input, newW, newH } = this.preprocess(imageData);
        if (onProgress) onProgress(30);

        const tensor = new ort.Tensor('float32', input, [1, 3, newH, newW]);
        const results = await this.session.run({ input: tensor });
        let matte = results.output.data;

        if (onProgress) onProgress(70);
        const result = this.applyMatte(imageData, matte, newW, newH, imageData.width, imageData.height);
        if (onProgress) onProgress(100);
        return result;
    }

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

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.putImageData(imageData, 0, 0);

        const totalPixels = width * height;
        const accumValues = new Float64Array(totalPixels);
        const accumWeights = new Float64Array(totalPixels);

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const tileW = Math.min(tileSize, width - x);
                const tileH = Math.min(tileSize, height - y);
                const tileImageData = tempCtx.getImageData(x, y, tileW, tileH);
                const { input, newW: matW, newH: matH } = this.preprocess(tileImageData);

                const tensor = new ort.Tensor('float32', input, [1, 3, matH, matW]);
                const results = await this.session.run({ input: tensor });
                let tileMatte = results.output.data;

                const matteGray = new Uint8Array(tileMatte.length);
                for (let i = 0; i < tileMatte.length; i++) {
                    const v = tileMatte[i];
                    matteGray[i] = v < 0.05 ? 0 : (v > 0.85 ? 255 : Math.round(((v - 0.05) / 0.8) * 255));
                }

                const tempMatteCanvas = document.createElement('canvas');
                tempMatteCanvas.width = matW;
                tempMatteCanvas.height = matH;
                const tempMatteCtx = tempMatteCanvas.getContext('2d', { willReadFrequently: true });
                const tempMatteData = tempMatteCtx.createImageData(matW, matH);
                for (let i = 0; i < matteGray.length; i++) {
                    const idx = i * 4;
                    tempMatteData.data[idx] = matteGray[i];
                    tempMatteData.data[idx + 1] = matteGray[i];
                    tempMatteData.data[idx + 2] = matteGray[i];
                    tempMatteData.data[idx + 3] = 255;
                }
                tempMatteCtx.putImageData(tempMatteData, 0, 0);

                const scaledMatteCanvas = document.createElement('canvas');
                scaledMatteCanvas.width = tileW;
                scaledMatteCanvas.height = tileH;
                const scaledMatteCtx = scaledMatteCanvas.getContext('2d', { willReadFrequently: true });
                scaledMatteCtx.drawImage(tempMatteCanvas, 0, 0, tileW, tileH);
                const scaledMatteData = scaledMatteCtx.getImageData(0, 0, tileW, tileH);

                for (let ty = 0; ty < tileH; ty++) {
                    for (let tx = 0; tx < tileW; tx++) {
                        const pixelIdx = (y + ty) * width + (x + tx);
                        const srcIdx = (ty * tileW + tx) * 4;
                        const blendWeight = this.getBlendWeight(tx, ty, tileW, tileH, overlap);
                        accumValues[pixelIdx] += scaledMatteData.data[srcIdx] * blendWeight;
                        accumWeights[pixelIdx] += blendWeight;
                    }
                }
                processedTiles++;
                if (onProgress) onProgress(Math.round((processedTiles / totalTiles) * 80));
            }
        }

        const matteData = new ImageData(width, height);
        for (let i = 0; i < totalPixels; i++) {
            const alpha = accumWeights[i] > 0 ? Math.round(accumValues[i] / accumWeights[i]) : 0;
            matteData.data[i * 4 + 3] = Math.min(255, alpha);
        }

        const result = new ImageData(width, height);
        for (let i = 0; i < totalPixels; i++) {
            result.data[i * 4] = imageData.data[i * 4];
            result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
            result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
            result.data[i * 4 + 3] = matteData.data[i * 4 + 3];
        }
        if (onProgress) onProgress(100);
        return result;
    }

    getBlendWeight(tx, ty, tileW, tileH, overlap) {
        const edgeDist = Math.min(tx, ty, tileW - 1 - tx, tileH - 1 - ty);
        if (edgeDist >= overlap) return 1.0;
        const t = edgeDist / overlap;
        return t * t * (3 - 2 * t);
    }

    preprocess(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const { scaleX, scaleY, newW, newH } = this.getResizeParams(width, height);

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        srcCtx.putImageData(imageData, 0, 0);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newW;
        tempCanvas.height = newH;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(srcCanvas, 0, 0, newW, newH);
        const scaledData = tempCtx.getImageData(0, 0, newW, newH);

        const pixels = newW * newH;
        const input = new Float32Array(pixels * 3);
        for (let i = 0; i < pixels; i++) {
            const srcIdx = i * 4;
            input[i] = (scaledData.data[srcIdx] - 127.5) / 127.5;
            input[pixels + i] = (scaledData.data[srcIdx + 1] - 127.5) / 127.5;
            input[pixels * 2 + i] = (scaledData.data[srcIdx + 2] - 127.5) / 127.5;
        }
        return { input, scaleX, scaleY, newW, newH };
    }

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
        newW = newW - (newW % 32);
        newH = newH - (newH % 32);
        if (newW < 32) newW = 32;
        if (newH < 32) newH = 32;
        return { scaleX: newW / imW, scaleY: newH / imH, newW, newH };
    }

    applyMatte(imageData, matte, matteW, matteH, origW, origH) {
        const matteCanvas = document.createElement('canvas');
        matteCanvas.width = matteW;
        matteCanvas.height = matteH;
        const matteCtx = matteCanvas.getContext('2d', { willReadFrequently: true });
        const matteImgData = matteCtx.createImageData(matteW, matteH);
        for (let y = 0; y < matteH; y++) {
            for (let x = 0; x < matteW; x++) {
                const idx = y * matteW + x;
                const v = matte[idx];
                const val = v < 0.05 ? 0 : (v > 0.85 ? 255 : Math.round(((v - 0.05) / 0.8) * 255));
                const dst = (y * matteW + x) * 4;
                matteImgData.data[dst] = val;
                matteImgData.data[dst + 1] = val;
                matteImgData.data[dst + 2] = val;
                matteImgData.data[dst + 3] = 255;
            }
        }
        matteCtx.putImageData(matteImgData, 0, 0);
        const scaledMatteCanvas = document.createElement('canvas');
        scaledMatteCanvas.width = origW;
        scaledMatteCanvas.height = origH;
        const scaledCtx = scaledMatteCanvas.getContext('2d', { willReadFrequently: true });
        scaledCtx.drawImage(matteCanvas, 0, 0, origW, origH);
        const scaledMatte = scaledCtx.getImageData(0, 0, origW, origH);

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
