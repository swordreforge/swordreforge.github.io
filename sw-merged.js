// Merged Service Worker for COOP/COEP and caching
// 合并的 Service Worker，同时处理 COOP/COEP 和资源缓存

const CACHE_NAME = 'photon-wasm-v19';
const ASSETS_TO_CACHE = [
  './pkg/photon_wasm_bg.wasm',
  './pkg/photon_wasm_bg.js',
  './index.html',
  './coi-serviceworker.min.js'
];

// COOP/COEP configuration
let coepCredentialless = false;

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

// 处理 COOP/COEP 消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'coepCredentialless') {
    coepCredentialless = event.data.value;
  }
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

// 拦截请求：处理 COOP/COEP 头和缓存
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 处理 COOP/COEP 头
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  const modifiedRequest = coepCredentialless && request.mode === 'no-cors'
    ? new Request(request, { credentials: 'omit' })
    : request;

  // 检查是否需要缓存
  const requestUrl = request.url;
  const shouldCache = requestUrl.includes('.wasm') ||
                      requestUrl.includes('.js') ||
                      requestUrl.includes('.css') ||
                      requestUrl.includes('coi-serviceworker');

  if (shouldCache) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('[SW] Cache hit:', requestUrl);
            // 添加 COOP/COEP 头
            return addCoepHeaders(response);
          }
          console.log('[SW] Cache miss, fetching:', requestUrl);
          return fetch(modifiedRequest)
            .then((networkResponse) => {
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return addCoepHeaders(networkResponse);
              }
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
              return addCoepHeaders(networkResponse);
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
  } else {
    // 其他请求直接处理，但添加 COOP/COEP 头
    event.respondWith(
      fetch(modifiedRequest)
        .then((networkResponse) => {
          return addCoepHeaders(networkResponse);
        })
        .catch((error) => {
          console.log('[SW] Network failed, trying cache:', requestUrl);
          return caches.match(request);
        })
    );
  }
});

// 添加 COOP/COEP 头的辅助函数
function addCoepHeaders(response) {
  if (!response) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
  if (!coepCredentialless) {
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}
