// 協同組合コラボジャパン 議事録AI PWA Service Worker (v19 - MP4 Video & Fast Audio Extraction Support)
const CACHE_NAME = 'collabo-minutes-pwa-v19';
const ASSETS = [
  './mobile.html',
  './mobile_manual.html',
  './manifest.json',
  './icon-192.png',
  './icon.png'
];

// インストール時にスマホ用資材をキャッシュ & 即時有効化
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Pre-cache warning:', err);
      });
    })
  );
});

// 古いキャッシュを即時全削除し、全クライアントへ即時反映
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// メッセージハンドラ（即時アクティベーション用）
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// フェッチ処理
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 【最重要】APIリクエスト・エンドポイント探索通信はService Workerで一切横取り・キャッシュしない
  if (
    url.pathname.includes('/api/') ||
    url.pathname.endsWith('endpoint.json') ||
    url.hostname === 'api.github.com' ||
    url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.endsWith('.trycloudflare.com') && url.pathname.includes('/api/')
  ) {
    return;
  }

  // 2. 【最重要】PCローカルのDXコントロールセンター本体（127.0.0.1:8500/ や localhost:8500/index.html）は横取りしない
  if (
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
    (url.pathname === '/' || url.pathname === '/index.html')
  ) {
    return;
  }

  // 3. ページ遷移（HTML表示）: 【Network First】常に最新のHTMLを取得し、電波圏外のみキャッシュへフォールバック
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    if (url.pathname.includes('manual')) {
      event.respondWith(
        fetch(event.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put('./mobile_manual.html', clone));
          }
          return resp;
        }).catch(() => caches.match('./mobile_manual.html'))
      );
      return;
    }

    if (url.pathname.includes('mobile') || url.hostname.endsWith('github.io')) {
      event.respondWith(
        fetch(event.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put('./mobile.html', clone));
          }
          return resp;
        }).catch(() => caches.match('./mobile.html'))
      );
      return;
    }
    return;
  }

  // 4. 静的資材（アイコン等）
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      });
    }).catch(() => fetch(event.request))
  );
});
