// ============================================================
// sw.js | AsirLabo OS - JWA Wellness
// Service Worker - Network First Strategy (認証・API優先)
// ============================================================

const CACHE_NAME = 'asir-labo-v2';

// キャッシュするスタティックアセット（CSSのみ）
const STATIC_ASSETS = [
  '/style.css',
  '/form.css',
  '/manifest.json'
];

// ── Install: スタティックアセットをキャッシュ ──
self.addEventListener('install', (e) => {
  console.log('[SW] Install v2');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // 即座にアクティベート
  );
});

// ── Activate: 古いキャッシュを削除 ──
self.addEventListener('activate', (e) => {
  console.log('[SW] Activate');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network First（認証・Supabase系は常にネットワーク優先）──
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Supabase / 外部API / POST は SW をスキップ（キャッシュしない）
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('jsdelivr.net') ||
    e.request.method !== 'GET'
  ) {
    return; // ブラウザのデフォルト処理に任せる
  }

  // スタティックアセット: Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // 成功したレスポンスのみキャッシュ
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, toCache));
        }
        return response;
      });
    })
  );
});
