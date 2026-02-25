// Service Worker for caching static assets
// 缓存 WASM 文件以提升用户体验

const CACHE_NAME = 'photon-wasm-v18';
const ASSETS_TO_CACHE = [
  './pkg/photon_wasm_bg.wasm',
  './pkg/photon_wasm_bg.js',
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

// 拦截请求：根据资源类型使用不同策略
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;

  // WASM、JS 和 CSS 文件使用缓存优先策略，提升加载速度
  if (requestUrl.includes('.wasm') ||
      requestUrl.includes('.js') ||
      requestUrl.includes('.css')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 缓存命中，直接返回
          if (response) {
            console.log('[SW] Cache hit:', requestUrl);
            return response;
          }
          // 缓存未命中，网络请求并缓存
          console.log('[SW] Cache miss, fetching:', requestUrl);
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
            })
            .catch((error) => {
              console.error('[SW] Network request failed:', requestUrl, error);
              throw error;
            });
        })
        .catch((error) => {
          console.error('[SW] Cache and network both failed:', requestUrl, error);
          throw error;
        })
    );
    return;
  }

  // 其他请求使用网络优先策略
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch((error) => {
        console.log('[SW] Network failed, trying cache:', requestUrl);
        return caches.match(event.request);
      })
  );
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