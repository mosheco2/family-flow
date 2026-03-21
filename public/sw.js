const CACHE_NAME = 'oneflow-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/business.html',
  '/common.js',
  '/app-family.js',
  '/app-business.js',
  '/logo.png',
  '/manifest.json'
];

// התקנת ה-Service Worker ושמירת קבצי הליבה ב-Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// הפעלה וניקוי קאש ישן אם יש
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// יירוט בקשות רשת (Fetch)
self.addEventListener('fetch', (event) => {
  // אנחנו לא רוצים לעשות קאש לקריאות API, רק לקבצים סטטיים
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // אם הקובץ קיים בקאש, נחזיר אותו. אחרת ניקח מהרשת
        return response || fetch(event.request).catch(() => {
          // במידה ואין אינטרנט והבקשה נכשלה, אפשר להחזיר עמוד אופליין
          // כרגע נחזיר פשוט התעלמות
        });
      })
  );
});
