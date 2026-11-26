const CACHE_NAME = "voyage-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/responsive.css",
  "./css/themes.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/budget.js",
  "./js/itinerary.js",
  "./js/export.js",
  "./js/api/adapters.js",
  "./manifest.json",
  "./assets/icons/icon.svg"
];

const assetURL = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.map(assetURL));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("voyage-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// Network-first: use the latest deployed file whenever online.
// Fall back to the cache only when the network is unavailable.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestURL = new URL(event.request.url);
  if (requestURL.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: "no-cache" });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      if (event.request.mode === "navigate") {
        const fallback = await caches.match(assetURL("./index.html"));
        if (fallback) return fallback;
      }

      return new Response("오프라인 상태입니다. 인터넷 연결 후 다시 시도해 주세요.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
