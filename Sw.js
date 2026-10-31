// Caches game art on the player's device so repeat visits load instantly.
// Images are served from the cache immediately, then refreshed in the
// background, so updated art shows up on the player's next visit.
const ART_CACHE = 'game-art-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== ART_CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;           // leave multiplayer/PeerJS traffic alone
    if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(url.pathname)) return; // only cache images

    event.respondWith(
        caches.open(ART_CACHE).then(cache =>
            cache.match(req).then(cached => {
                const refresh = fetch(req).then(res => {
                    if (res && res.ok) cache.put(req, res.clone());
                    return res;
                }).catch(() => cached);
                return cached || refresh;
            })
        )
    );
});