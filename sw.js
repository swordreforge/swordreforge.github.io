// Service Worker for caching WASM and static assets
// 强缓存 WASM 文件和其他静态资源，提高加载性能

const CACHE_NAME = 'photon-wasm-v1';
const ASSETS_TO_CACHE = [
  './pkg/photon_wasm.js',
  './pkg/photon_wasm_bg.wasm',
  './pkg/photon_wasm.d.ts',
  './pkg/photon_wasm_bg.wasm.d.ts',
  './index.html'
];

// 安装事件：缓存关键资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell and content');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 拦截请求：优先从缓存读取
self.addEventListener('fetch', (event) => {
  // 对 WASM 文件和静态资源使用缓存优先策略
  if (event.request.url.includes('.wasm') ||
      event.request.url.includes('.js') ||
      event.request.url.includes('.css')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 缓存命中，直接返回
          if (response) {
            console.log('[SW] Cache hit:', event.request.url);
            return response;
          }
          // 缓存未命中，网络请求并缓存
          console.log('[SW] Cache miss, fetching:', event.request.url);
          return fetch(event.request)
            .then((networkResponse) => {
              // 检查是否有效响应
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return networkResponse;
              }
              // 克隆响应并缓存
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              return networkResponse;
            });
        })
        .catch(() => {
          console.error('[SW] Network request failed:', event.request.url);
        })
    );
  } else {
    // 其他请求使用网络优先策略
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// 监听消息：更新缓存
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'UPDATE_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.addAll(ASSETS_TO_CACHE);
        })
    );
  }
});