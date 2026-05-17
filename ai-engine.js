function getWasmUrl() {
  return new URL('./wllama/esm/wasm/wllama.wasm', document.baseURI).href;
}

let wllamaModule = null;

async function getWllama() {
  if (!wllamaModule) {
    wllamaModule = await import('./wllama/esm/index.js');
  }
  return wllamaModule;
}

export class WllamaBackend {
  constructor() {
    this.wllama = null;
    this.modelLoaded = false;
    this.modelName = '';
    this.isMultimodal = false;
    this._abortController = null;
  }

  async loadModel(config) {
    if (!config || !config.url) {
      throw new Error('loadModel requires config with at least a url');
    }
    const { name, url, mmprojUrl, onProgress } = config;
    if (this.wllama) {
      await this.unloadModel();
    }
    const { Wllama } = await getWllama();
    this.wllama = new Wllama({ default: getWasmUrl() });
    const params = {
      n_ctx: 8192,
      n_threads: navigator.hardwareConcurrency || 4
    };
    if (onProgress) {
      params.progressCallback = onProgress;
    }
    const resolveUrl = (u) => new URL(u, document.baseURI).href;
    const modelSource = mmprojUrl
      ? { url: resolveUrl(url), mmprojUrl: resolveUrl(mmprojUrl) }
      : resolveUrl(url);
    await this.wllama.loadModelFromUrl(modelSource, params);
    this.modelLoaded = true;
    this.modelName = name || '';
    this.isMultimodal = !!mmprojUrl;
  }

  async loadFromFile(file) {
    if (this.wllama) {
      await this.unloadModel();
    }
    const { Wllama } = await getWllama();
    this.wllama = new Wllama({ default: getWasmUrl() });
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    await this.wllama.loadModel([blob], {
      n_ctx: 8192,
      n_threads: navigator.hardwareConcurrency || 4
    });
    this.modelLoaded = true;
    this.modelName = file.name;
    this.isMultimodal = false;
  }

  async unloadModel() {
    if (this.wllama) {
      await this.wllama.exit();
    }
    this.wllama = null;
    this.modelLoaded = false;
    this.modelName = '';
    this.isMultimodal = false;
  }

  async chat(messages, tools) {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    try {
      return await this.wllama.createChatCompletion({
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 2048,
        temp: 0.7,
        top_p: 0.9,
        top_k: 40,
        abortSignal: this._abortController.signal
      });
    } finally {
      this._abortController = null;
    }
  }

  async dispose() {
    await this.unloadModel();
  }

  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  getStatus() {
    return {
      loaded: this.modelLoaded,
      modelName: this.modelName,
      isMultimodal: this.isMultimodal
    };
  }
}

export class RemoteBackend {
  constructor() {
    this.apiKey = '';
    this.baseUrl = '';
    this.model = '';
    this._abortController = null;
  }

  configure(config) {
    if (!config) return;
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
    if (config.model !== undefined) this.model = config.model;
  }

  async chat(messages, tools) {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 2048
        }),
        signal: this._abortController.signal
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${response.status}`);
      }
      return await response.json();
    } finally {
      this._abortController = null;
    }
  }

  abort() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  getStatus() {
    return {
      configured: !!(this.apiKey && this.baseUrl && this.model),
      baseUrl: this.baseUrl,
      model: this.model
    };
  }
}

export class AiEngine {
  constructor() {
    this.localBackend = new WllamaBackend();
    this.remoteBackend = new RemoteBackend();
    this._backendType = 'remote';
  }

  switchBackend(type) {
    if (type !== 'local' && type !== 'remote') {
      throw new Error(`Invalid backend type: ${type}. Must be 'local' or 'remote'.`);
    }
    if (type !== this._backendType) {
      this.getCurrentBackend().abort();
      this._backendType = type;
    }
  }

  getCurrentBackend() {
    return this._backendType === 'local' ? this.localBackend : this.remoteBackend;
  }

  async chat(messages, tools) {
    return this.getCurrentBackend().chat(messages, tools);
  }

  async loadModel(config) {
    if (this._backendType !== 'local') {
      throw new Error('Cannot load model in remote mode. Switch to local backend first.');
    }
    return this.localBackend.loadModel(config);
  }

  async loadFromFile(file) {
    if (this._backendType !== 'local') {
      throw new Error('Cannot load model in remote mode. Switch to local backend first.');
    }
    return this.localBackend.loadFromFile(file);
  }

  async unloadModel() {
    return this.localBackend.unloadModel();
  }

  abort() {
    this.getCurrentBackend().abort();
  }

  getStatus() {
    if (this._backendType === 'local') {
      const s = this.localBackend.getStatus();
      return { type: 'local', loaded: s.loaded, modelName: s.modelName, isMultimodal: s.isMultimodal };
    }
    const s = this.remoteBackend.getStatus();
    return { type: 'remote', loaded: s.configured, modelName: s.model, isMultimodal: false };
  }
}
