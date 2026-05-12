async function loadTf() {
    if (window.tf) return window.tf;
    var tfLib = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm');
    window.tf = tfLib.default || tfLib;
    return window.tf;
}

const TILE_SIZE = 512;
const OVERLAP = 10;

class SuperResolution {
    constructor() {
        this.modelUrl = 'models/real_esrgan_x2_webgl/model.json';
        this.weightsUrl = 'models/real_esrgan_x2_webgl/weights.bin';
        this.loaded = false;
        this.layers = [];
        this.weightTensors = {};
    }

    async load() {
        if (this.loaded) return;
        const tf = await loadTf();

        const resp = await fetch(this.modelUrl);
        const modelJson = await resp.json();
        const manifest = modelJson.weightsManifest[0];

        const weightsResp = await fetch(this.weightsUrl);
        const weightsBuf = await weightsResp.arrayBuffer();

        let offset = 0;
        for (const spec of manifest.weights) {
            const size = spec.shape.reduce((a, b) => a * b, 1);
            const bytesPerElement = spec.dtype === 'float32' ? 4 : 2;
            const byteLength = size * bytesPerElement;
            const data = weightsBuf.slice(offset, offset + byteLength);

            let tensorData;
            if (spec.dtype === 'float32') {
                tensorData = new Float32Array(data);
            } else {
                tensorData = new Float32Array(data);
            }

            const tensor = tf.tensor(tensorData, spec.shape, 'float32');
            this.weightTensors[spec.name] = tensor;
            offset += byteLength;
        }

        this.buildGraph(modelJson);
        this.loaded = true;
    }

    buildGraph(modelJson) {
        const nodes = modelJson.modelTopology.node;
        for (const n of nodes) {
            if (n.op === 'Placeholder') continue;
            if (n.op === 'Conv2D') {
                const inputName = n.inputs[0];
                const weightName = n.inputs[1];
                this.layers.push({ type: 'conv2d', name: n.name, inputName, weightName, outputName: n.outputs[0] });
            } else if (n.op === 'Add') {
                const biasName = n.inputs[1];
                const inputName = n.inputs[0];
                this.layers.push({ type: 'bias', name: n.name, biasName, inputName, outputName: n.outputs[0] });
            } else if (n.op === 'Prelu') {
                const slopeName = n.inputs[1];
                const inputName = n.inputs[0];
                this.layers.push({ type: 'prelu', name: n.name, slopeName, inputName, outputName: n.outputs[0] });
            } else if (n.op === 'DepthToSpace') {
                const inputName = n.inputs[0];
                this.layers.push({ type: 'depthToSpace', name: n.name, inputName, outputName: n.outputs[0] });
            } else if (n.op === 'Transpose') {
                const inputName = n.inputs[0];
                const perm = n.attr.perm.list;
                this.layers.push({ type: 'transpose', name: n.name, inputName, perm, outputName: n.outputs[0] });
            }
        }
    }

    async executeNet(inputTensor) {
        const tf = await loadTf();
        const tensors = { 'input_placeholder': inputTensor };

        for (const layer of this.layers) {
            const inp = tensors[layer.inputName];
            if (!inp) {
                throw new Error(`Missing input ${layer.inputName} for ${layer.name}`);
            }

            let out;
            switch (layer.type) {
                case 'conv2d': {
                    const w = this.weightTensors[layer.weightName];
                    out = tf.conv2d(inp, w, [1, 1], 'same', 'NCHW');
                    break;
                }
                case 'bias': {
                    const b = this.weightTensors[layer.biasName];
                    out = tf.add(inp, b);
                    break;
                }
                case 'prelu': {
                    const slope = this.weightTensors[layer.slopeName];
                    out = tf.prelu(inp, slope);
                    break;
                }
                case 'depthToSpace': {
                    out = tf.depthToSpace(inp, 2, 'NCHW');
                    break;
                }
                case 'transpose': {
                    out = tf.transpose(inp, layer.perm);
                    break;
                }
            }

            tensors[layer.outputName] = out;
            if (inp !== inputTensor) inp.dispose();
        }

        return tensors['output'];
    }

    async process(imageData, onProgress, scale = 2) {
        await this.load();
        const width = imageData.width;
        const height = imageData.height;

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
        tensor.dispose();

        const resultNchw = await this.executeNet(nchw);
        const resultNhwc = tf.transpose(resultNchw, [0, 2, 3, 1]);
        const output = resultNhwc.squeeze().mul(255.0);

        const canvas = document.createElement('canvas');
        canvas.width = imageData.width * scale;
        canvas.height = imageData.height * scale;
        const outputImageData = await tf.browser.toPixels(output, canvas);
        return outputImageData;
    }

    async processTiled(imageData, width, height, scale, onProgress) {
        const tf = await loadTf();
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
                tensor.dispose();

                const resultNchw = await this.executeNet(nchw);
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
        const tf = window.tf;
        if (!tf) return;
        for (const name in this.weightTensors) {
            this.weightTensors[name].dispose();
        }
        this.weightTensors = {};
        this.loaded = false;
    }
}

export default SuperResolution;
