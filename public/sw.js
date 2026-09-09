const CACHE_NAME = 'family-flow-v255';
const STATIC_ASSETS = [
  '/index.html', '/app.js', '/business.html', '/business-app.js',
  '/manifest.json', '/manifest-business.json', '/favicon.png',
  '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/sa-bigscreen.html',
  '/kol-haam.html', '/kol-haam-app.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const _netErr = () => new Response('Network error', { status: 503, statusText: 'Service Unavailable' });

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // API calls: network-only, never cache
  if (url.pathname.startsWith('/api/') || url.port === '3000' || url.port === '10000') {
    event.respondWith(fetch(event.request).catch(_netErr));
    return;
  }
  if (event.request.method !== 'GET') return;
  // HTML + JS files + dynamic routes: network-first (always fresh)
  const _isHtmlRoute = url.pathname.endsWith('.html') || url.pathname.endsWith('.js')
    || url.pathname === '/'
    || url.pathname === '/kol-haam' || url.pathname.startsWith('/kol-haam/')
    || url.pathname.startsWith('/menu/') || url.pathname.startsWith('/menus/')
    || /^\/[a-zA-Z0-9_-]+$/.test(url.pathname);
  if (_isHtmlRoute) {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request).then(cached => cached || _netErr()))
    );
    return;
  }
  // Other assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => caches.match('/index.html').then(cached => cached || _netErr()));
    })
  );
});