/**
 * AquaticPro Service Worker
 * Provides offline caching and PWA functionality.
 * 
 * Cache strategy:
 *  - App shell (JS/CSS/fonts): Cache-first (fast loads)
 *  - API calls: Network-first (fresh data, offline fallback)
 *  - Images: Cache-first with expiry
 *  - Navigation: Network-first with offline fallback page
 */

const CACHE_VERSION = 'aquaticpro-v3';
const API_CACHE = 'aquaticpro-api-v3';

// App shell files to pre-cache on install
const APP_SHELL = [
    './',
];

// ============================================
// INSTALL — Pre-cache app shell
// ============================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// ============================================
// ACTIVATE — Clean old caches
// ============================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION && key !== API_CACHE)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================
// FETCH — Smart caching strategies
// ============================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Chrome extensions, analytics, etc.
    if (!url.protocol.startsWith('http')) return;

    // Strategy: API calls → Network-first
    if (url.pathname.includes('/wp-json/')) {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    // Strategy: Static assets (JS, CSS, fonts) → Cache-first
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Strategy: Navigation requests → Network-first with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, CACHE_VERSION));
        return;
    }

    // Everything else: Network-first
    event.respondWith(networkFirst(request, CACHE_VERSION));
});

// ============================================
// Caching Strategies
// ============================================

/**
 * Cache-first: Return cached version if available, otherwise fetch & cache.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Offline and not cached — return a basic offline response
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

/**
 * Network-first: Try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // For navigation requests, return a minimal offline page
        if (request.mode === 'navigate') {
            return new Response(
                `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AquaticPro — Offline</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #1f2937; }
        .card { text-align: center; padding: 2rem; max-width: 400px; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #6b7280; line-height: 1.6; }
        button { margin-top: 1rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; border: none; border-radius: 0.5rem; font-size: 0.875rem; cursor: pointer; }
        button:hover { background: #0284c7; }
    </style>
</head>
<body>
    <div class="card">
        <h1>You're Offline</h1>
        <p>AquaticPro requires an internet connection for most features. Please check your connection and try again.</p>
        <button onclick="location.reload()">Retry</button>
    </div>
</body>
</html>`,
                { status: 200, headers: { 'Content-Type': 'text/html' } }
            );
        }

        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

// ============================================
// Helpers
// ============================================

function isStaticAsset(pathname) {
    return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname);
}
