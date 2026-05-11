import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.all.min.mjs';

const MODEL_SIZE = 1024;
const INV_255 = 1 / 255;

class AiMattingCartoon {
    constructor() {
        this.session = null;
        this.modelUrl = 'models/bria_rmbg_quantized.onnx';
        this.loaded = false;
    }

    async load(onProgress) {
        if (this.loaded) return;

        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
        ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

        console.log(`BRIA RMBG: 加载模型 ${this.modelUrl}`);
        if (onProgress) onProgress('下载模型中...', 0);

        try {
            this.session = await ort.InferenceSession.create(this.modelUrl, {
                executionProviders: ['webgpu', 'wasm'],
                graphOptimizationLevel: 'all',
            });
            this.loaded = true;
            console.log('BRIA RMBG: 模型加载成功');
            if (onProgress) onProgress('模型加载成功', 100);
        } catch (e) {
            console.error('BRIA RMBG: URL 加载失败，尝试 ArrayBuffer:', e);
            if (onProgress) onProgress('下载模型中...', 0);
            const response = await fetch(this.modelUrl);
            if (!response.ok) throw new Error(`无法加载模型: ${response.status}`);

            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength) : null;
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                if (total && onProgress) {
                    onProgress('下载模型中...', Math.round((loaded / total) * 80));
                }
            }

            const modelBuffer = new Uint8Array(loaded);
            let offset = 0;
            for (const chunk of chunks) {
                modelBuffer.set(chunk, offset);
                offset += chunk.length;
            }

            console.log(`BRIA RMBG: 模型下载完成 (${(modelBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
            if (onProgress) onProgress('加载模型中...', 85);

            this.session = await ort.InferenceSession.create(modelBuffer.buffer, {
                executionProviders: ['webgpu', 'wasm'],
                graphOptimizationLevel: 'all',
            });
            this.loaded = true;
            console.log('BRIA RMBG: 模型加载成功');
            if (onProgress) onProgress('模型加载成功', 100);
        }
    }

    async process(imageData, onProgress) {
        await this.load();
        const width = imageData.width;
        const height = imageData.height;

        if (width <= MODEL_SIZE && height <= MODEL_SIZE) {
            return await this.processFull(imageData, onProgress);
        }
        return await this.processTiled(imageData, onProgress);
    }

    preprocess(imageData) {
        const w = imageData.width;
        const h = imageData.height;

        const scale = MODEL_SIZE / Math.max(w, h);
        const newW = Math.max(32, Math.round(w * scale / 32) * 32);
        const newH = Math.max(32, Math.round(h * scale / 32) * 32);

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = w;
        srcCanvas.height = h;
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        srcCtx.putImageData(imageData, 0, 0);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newW;
        tempCanvas.height = newH;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(srcCanvas, 0, 0, newW, newH);
        const scaledData = tempCtx.getImageData(0, 0, newW, newH);

        const padL = Math.floor((MODEL_SIZE - newW) / 2);
        const padT = Math.floor((MODEL_SIZE - newH) / 2);

        const pixels = MODEL_SIZE * MODEL_SIZE;
        const input = new Float32Array(pixels * 3);
        for (let y = 0; y < MODEL_SIZE; y++) {
            for (let x = 0; x < MODEL_SIZE; x++) {
                const sx = x - padL;
                const sy = y - padT;
                const idx = y * MODEL_SIZE + x;
                if (sx >= 0 && sx < newW && sy >= 0 && sy < newH) {
                    const srcIdx = (sy * newW + sx) * 4;
                    const r = scaledData.data[srcIdx] * INV_255 - 0.5;
                    const g = scaledData.data[srcIdx + 1] * INV_255 - 0.5;
                    const b = scaledData.data[srcIdx + 2] * INV_255 - 0.5;
                    input[idx] = r;
                    input[pixels + idx] = g;
                    input[pixels * 2 + idx] = b;
                } else {
                    input[idx] = 0;
                    input[pixels + idx] = 0;
                    input[pixels * 2 + idx] = 0;
                }
            }
        }
        return { input, padL, padT, newW, newH, origW: w, origH: h };
    }

    normalizeMask(data, start, count) {
        let min = Infinity;
        let max = -Infinity;
        const end = start + count;
        for (let i = start; i < end; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        const range = max - min;
        if (range < 1e-8) return 0;
        return { min, range };
    }

    async processFull(imageData, onProgress) {
        const { input, padL, padT, newW, newH, origW, origH } = this.preprocess(imageData);
        if (onProgress) onProgress(30);

        const tensor = new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
        const results = await this.session.run({ input: tensor });
        const matte = results.output.data;

        if (onProgress) onProgress(70);
        const result = this.applyMatte(imageData, matte, padL, padT, newW, newH, origW, origH);
        if (onProgress) onProgress(100);
        return result;
    }

    async processTiled(imageData, onProgress) {
        const width = imageData.width;
        const height = imageData.height;
        const step = MODEL_SIZE - 32;
        const tilesX = Math.ceil(width / step);
        const tilesY = Math.ceil(height / step);
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

        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const tileW = Math.min(MODEL_SIZE, width - x);
                const tileH = Math.min(MODEL_SIZE, height - y);

                cropCanvas.width = tileW;
                cropCanvas.height = tileH;
                cropCtx.drawImage(tempCanvas, x, y, tileW, tileH, 0, 0, tileW, tileH);
                const tileData = cropCtx.getImageData(0, 0, tileW, tileH);

                const { input, padL, padT, newW, newH } = this.preprocess(tileData);

                const tensor = new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
                const results = await this.session.run({ input: tensor });
                const tileMatte = results.output.data;

                const unpaddedCount = newW * newH;
                const offset = padT * MODEL_SIZE + padL;
                const nm = this.normalizeMask(tileMatte, offset, unpaddedCount);
                const matteCanvas = document.createElement('canvas');
                matteCanvas.width = newW;
                matteCanvas.height = newH;
                const matteCtx = matteCanvas.getContext('2d', { willReadFrequently: true });
                const matteImageData = matteCtx.createImageData(newW, newH);
                for (let my = 0; my < newH; my++) {
                    for (let mx = 0; mx < newW; mx++) {
                        const srcIdx = (padT + my) * MODEL_SIZE + (padL + mx);
                        let v;
                        if (nm === 0) {
                            v = 0;
                        } else {
                            v = ((tileMatte[srcIdx] - nm.min) / nm.range) * 255;
                        }
                        const val = Math.min(255, Math.max(0, Math.round(v)));
                        const dst = (my * newW + mx) * 4;
                        matteImageData.data[dst] = val;
                        matteImageData.data[dst + 1] = val;
                        matteImageData.data[dst + 2] = val;
                        matteImageData.data[dst + 3] = 255;
                    }
                }
                matteCtx.putImageData(matteImageData, 0, 0);

                const scaledMatteCanvas = document.createElement('canvas');
                scaledMatteCanvas.width = tileW;
                scaledMatteCanvas.height = tileH;
                const scaledMatteCtx = scaledMatteCanvas.getContext('2d', { willReadFrequently: true });
                scaledMatteCtx.drawImage(matteCanvas, 0, 0, tileW, tileH);
                const scaledMatteData = scaledMatteCtx.getImageData(0, 0, tileW, tileH);

                for (let ty = 0; ty < tileH; ty++) {
                    for (let tx = 0; tx < tileW; tx++) {
                        const pixelIdx = (y + ty) * width + (x + tx);
                        const srcIdx = (ty * tileW + tx) * 4;
                        const blendWeight = this.getBlendWeight(tx, ty, tileW, tileH, 32);
                        accumValues[pixelIdx] += scaledMatteData.data[srcIdx] * blendWeight;
                        accumWeights[pixelIdx] += blendWeight;
                    }
                }

                processedTiles++;
                if (onProgress) onProgress(Math.round((processedTiles / totalTiles) * 80));
            }
        }

        const result = new ImageData(width, height);
        for (let i = 0; i < totalPixels; i++) {
            const alpha = accumWeights[i] > 0 ? Math.round(accumValues[i] / accumWeights[i]) : 0;
            const clamped = Math.min(255, Math.max(0, alpha));
            result.data[i * 4] = imageData.data[i * 4];
            result.data[i * 4 + 1] = imageData.data[i * 4 + 1];
            result.data[i * 4 + 2] = imageData.data[i * 4 + 2];
            result.data[i * 4 + 3] = clamped;
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

    applyMatte(imageData, matte, padL, padT, newW, newH, origW, origH) {
        const unpaddedCount = newW * newH;
        const offset = padT * MODEL_SIZE + padL;
        const nm = this.normalizeMask(matte, offset, unpaddedCount);

        const result = new ImageData(origW, origH);
        for (let y = 0; y < origH; y++) {
            for (let x = 0; x < origW; x++) {
                const sx = Math.round(x * (newW / origW));
                const sy = Math.round(y * (newH / origH));
                const srcIdx = (padT + sy) * MODEL_SIZE + (padL + sx);
                let v;
                if (nm === 0) {
                    v = 0;
                } else {
                    v = ((matte[srcIdx] - nm.min) / nm.range) * 255;
                }
                const alpha = Math.min(255, Math.max(0, Math.round(v)));
                const dstIdx = (y * origW + x) * 4;
                result.data[dstIdx] = imageData.data[dstIdx];
                result.data[dstIdx + 1] = imageData.data[dstIdx + 1];
                result.data[dstIdx + 2] = imageData.data[dstIdx + 2];
                result.data[dstIdx + 3] = alpha;
            }
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

export default AiMattingCartoon;
