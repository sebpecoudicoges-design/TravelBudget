const TB_SW_VERSION = "travelbudget-pwa-10.5.203";
const TB_STATIC_CACHE = `${TB_SW_VERSION}-static`;
const TB_RUNTIME_CACHE = `${TB_SW_VERSION}-runtime`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/pwa-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(TB_STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("travelbudget-pwa-") && !key.startsWith(TB_SW_VERSION))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldCache(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  return false;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (shouldCache(request) && response && response.ok) {
      const cache = await caches.open(TB_RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(request.url);
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(TB_RUNTIME_CACHE);
    cache.put("/index.html", response.clone()).catch(() => {});
    return response;
  } catch (_) {
    return (await caches.match("/index.html")) || (await caches.match("/offline.html"));
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (shouldCache(request) && response && response.ok) {
      const cache = await caches.open(TB_RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (!shouldCache(request)) return;
  if (["script", "style", "worker"].includes(request.destination)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "TB_CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(TB_RUNTIME_CACHE);
    const urls = Array.from(new Set(data.urls))
      .map((url) => {
        try { return new URL(url, self.location.origin).toString(); } catch (_) { return ""; }
      })
      .filter(Boolean)
      .filter((url) => shouldCache(new Request(url)));

    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }));
  })());
});
