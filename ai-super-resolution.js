// 使用全局 TFJS (由 index.html 中的 script 标签加载)
async function loadTf() {
    if (window.tf) return window.tf;
    // 如果 script 标签加载失败，回退到动态导入
    var tfLib = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm');
    window.tf = tfLib.default || tfLib;
    return window.tf;
}

const TILE_SIZE = 512;
const OVERLAP = 10;

class SuperResolution {
    constructor() {
        this.model = null;
        this.modelUrl = 'models/real_esrgan_x2_webgl/model.json';
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;
        const tf = await loadTf();
        this.model = await tf.loadGraphModel(this.modelUrl);
        this.loaded = true;
    }

    async process(imageData, onProgress, scale = 2) {
        await this.load();

        const width = imageData.width;
        const height = imageData.height;
        const totalPixels = width * height;

        if (width <= TILE_SIZE && height <= TILE_SIZE) {
            return await this.processFull(imageData, scale);
        }

        return await this.processTiled(imageData, width, height, scale, onProgress);
    }

    async processFull(imageData, scale) {
        const tf = await loadTf();
        const tensor = tf.browser.fromPixels(imageData);
        const expanded = tensor.expandDims(0);
        const normalized = expanded.div(255.0);
        const nchw = tf.transpose(normalized, [0, 3, 1, 2]);

        const resultNchw = this.model.predict(nchw);
        const resultNhwc = tf.transpose(resultNchw, [0, 2, 3, 1]);
        const output = resultNhwc.squeeze().mul(255.0);

        const canvas = document.createElement('canvas');
        canvas.width = imageData.width * scale;
        canvas.height = imageData.height * scale;
        const outputImageData = await tf.browser.toPixels(output, canvas);
        return outputImageData;
    }

    async processTiled(imageData, width, height, scale, onProgress) {
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = scaledWidth;
        outputCanvas.height = scaledHeight;
        const outputCtx = outputCanvas.getContext('2d');
        const outputImageData = outputCtx.getImageData(0, 0, scaledWidth, scaledHeight);

        const tileSize = TILE_SIZE;
        const step = tileSize - OVERLAP;
        const tilesX = Math.ceil((width - OVERLAP) / step);
        const tilesY = Math.ceil((height - OVERLAP) / step);
        const totalTiles = tilesX * tilesY;
        let processedTiles = 0;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const tileW = Math.min(tileSize, width - x);
                const tileH = Math.min(tileSize, height - y);

                const tileImageData = tempCtx.getImageData(x, y, tileW, tileH);

                const tensor = tf.browser.fromPixels(tileImageData);
                const expanded = tensor.expandDims(0);
                const normalized = expanded.div(255.0);
                const nchw = tf.transpose(normalized, [0, 3, 1, 2]);

                const resultNchw = this.model.predict(nchw);
                const resultNhwc = tf.transpose(resultNchw, [0, 2, 3, 1]);
                const outputTensor = resultNhwc.squeeze().mul(255.0);

                const scaledTileW = tileW * scale;
                const scaledTileH = tileH * scale;
                const tileCanvas = document.createElement('canvas');
                tileCanvas.width = scaledTileW;
                tileCanvas.height = scaledTileH;
                const tiledImageData = await tf.browser.toPixels(outputTensor, tileCanvas);

                const scaledX = x * scale;
                const scaledY = y * scale;

                for (let ty = 0; ty < scaledTileH; ty++) {
                    for (let tx = 0; tx < scaledTileW; tx++) {
                        const dstIdx = (scaledY + ty) * scaledWidth * 4 + (scaledX + tx) * 4;
                        const srcIdx = ty * scaledTileW * 4 + tx * 4;
                        outputImageData.data[dstIdx] = tiledImageData.data[srcIdx];
                        outputImageData.data[dstIdx + 1] = tiledImageData.data[srcIdx + 1];
                        outputImageData.data[dstIdx + 2] = tiledImageData.data[srcIdx + 2];
                        outputImageData.data[dstIdx + 3] = tiledImageData.data[srcIdx + 3];
                    }
                }

                processedTiles++;
                if (onProgress) {
                    onProgress(Math.round((processedTiles / totalTiles) * 100));
                }
            }
        }

        outputCtx.putImageData(outputImageData, 0, 0);
        return outputCtx.getImageData(0, 0, scaledWidth, scaledHeight);
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
            this.loaded = false;
        }
    }
}

export default SuperResolution;