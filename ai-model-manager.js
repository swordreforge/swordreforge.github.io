const STORAGE_KEY = 'ai_cached_models';

class ModelManager {
  static PRESET_MODELS = [
    {
      id: 'qwen2.5-1.5b',
      name: 'Qwen2.5-1.5B-Instruct',
      type: 'standard',
      repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      mmproj: null,
      size: '~1.1GB',
      url: './Qwen2.5-1.5B-Instruct-GGUF/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    },
    {
      id: 'qwen2.5-vl-3b',
      name: 'Qwen2.5-VL-3B-Instruct',
      type: 'multimodal',
      repo: 'ggml-org/Qwen2.5-VL-3B-Instruct-GGUF',
      file: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
      mmproj: 'mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
      size: '~1.8GB',
      url: null,
    },
  ];

  constructor() {
    this.cachedModels = [];
    this.loadCacheState();
  }

  async loadCacheState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cachedModels = JSON.parse(raw);
      }
    } catch {
      this.cachedModels = [];
    }
  }

  persistCacheState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cachedModels));
  }

  async downloadModel(presetId, onProgress) {
    const preset = ModelManager.PRESET_MODELS.find((m) => m.id === presetId);
    if (!preset) {
      throw new Error(`Unknown preset model: ${presetId}`);
    }
    const existing = this.cachedModels.find((m) => m.id === presetId);
    if (existing) {
      return existing;
    }
    if (preset.url && preset.url.startsWith('./')) {
      const response = await fetch(preset.url, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Model file not available at ${preset.url}`);
      }
    }
    const entry = {
      id: preset.id,
      name: preset.name,
      type: preset.type,
      file: preset.file,
      cached: true,
      localPath: preset.url,
      ts: Date.now(),
    };
    this.cachedModels.push(entry);
    this.persistCacheState();
    return entry;
  }

  async loadFromFile(file) {
    return {
      id: 'custom_' + Date.now(),
      name: file.name,
      type: 'custom',
      file: file.name,
      cached: true,
      localPath: null,
      ts: Date.now(),
    };
  }

  getCachedModels() {
    return [...this.cachedModels];
  }

  async deleteCachedModel(id) {
    this.cachedModels = this.cachedModels.filter((m) => m.id !== id);
    this.persistCacheState();
  }

  async getCacheSize() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage, quota: estimate.quota };
    }
    return null;
  }
}

export { ModelManager };
