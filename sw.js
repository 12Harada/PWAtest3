const CACHE_NAME = 'customer-map-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';
const API_CACHE = 'api-v2';

const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/api.js',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Service Worker インストール
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Service Worker フェッチ
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // APIリクエストの場合は専用のハンドリング
    if (request.url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // 静的アセットの場合はCache Firstストラテジー
    if (isStaticAsset(request.url)) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request))
        );
        return;
    }
    
    // その他のリクエストはNetwork Firstストラテジー
    event.respondWith(
        fetch(request)
            .then(response => {
                // 正常なレスポンスの場合のみキャッシュ
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => cache.put(request, responseClone));
                }
                return response;
            })
            .catch(() => {
                // ネットワークエラー時はキャッシュから返す
                return caches.match(request);
            })
    );
});

// 静的アセットかどうかを判定
function isStaticAsset(url) {
    return url.includes('.css') || 
           url.includes('.js') || 
           url.includes('.png') || 
           url.includes('.jpg') || 
           url.includes('.svg') ||
           url.includes('leaflet');
}

// APIリクエストの処理
async function handleAPIRequest(request) {
    try {
        // まずネットワークから取得を試行
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // 成功した場合はキャッシュに保存
            const responseClone = networkResponse.clone();
            const cache = await caches.open(API_CACHE);
            await cache.put(request, responseClone);
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
    } catch (error) {
        // ネットワークエラーの場合はキャッシュから返す
        console.log('[SW] Network failed, trying cache');
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // キャッシュもない場合はオフライン用のレスポンスを返す
        return new Response(JSON.stringify({
            success: false,
            error: 'オフラインです。ネットワーク接続を確認してください。'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!currentCaches.includes(cacheName)) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Activated');
            return self.clients.claim();
        })
    );
});