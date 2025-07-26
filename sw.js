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
    '/manifest.json'
];

// Service Worker インストール
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(urlsToCache).catch(err => {
                    console.warn('[SW] Failed to cache some resources:', err);
                });
            })
    );
    self.skipWaiting();
});

// Service Worker フェッチ
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // chrome-extension スキームなどのサポートされていないスキームをスキップ
    if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
        return;
    }
    
    // APIリクエストの場合は専用のハンドリング
    if (request.url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // 静的アセットの場合はCache Firstストラテジー
    if (isStaticAsset(request.url)) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request).catch(() => {
                    console.warn('[SW] Failed to fetch:', request.url);
                    return new Response('', { status: 404 });
                }))
        );
        return;
    }
    
    // その他のリクエストはNetwork Firstストラテジー
    event.respondWith(
        fetch(request)
            .then(response => {
                // 正常なレスポンスの場合のみキャッシュ
                if (response.status === 200 && response.url.startsWith('http')) {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(request, responseClone).catch(err => {
                                console.warn('[SW] Failed to cache:', request.url, err);
                            });
                        });
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

// プッシュ通知受信
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Customer Map', body: event.data.text() };
        }
    }
    
    const options = {
        title: data.title || 'Customer Map',
        body: data.body || '新しい通知があります',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%232196F3"/%3E%3Ctext x="96" y="96" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle"%3ECM%3C/text%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Crect width="96" height="96" fill="%232196F3"/%3E%3Ctext x="48" y="48" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3ECM%3C/text%3E%3C/svg%3E',
        vibrate: [300, 100, 400],
        data: data,
        actions: [
            {
                action: 'open',
                title: '開く'
            },
            {
                action: 'close',
                title: '閉じる'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // 既に開いているウィンドウがあれば、そちらにフォーカス
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // なければ新しいウィンドウを開く
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

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