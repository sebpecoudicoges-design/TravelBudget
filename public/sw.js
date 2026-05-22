const TB_SW_VERSION = "travelbudget-pwa-v1";
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
  return [
    "cdn.jsdelivr.net"
  ].includes(url.hostname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (shouldCache(request)) {
    const cache = await caches.open(TB_RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (!shouldCache(request)) return;
  event.respondWith(cacheFirst(request));
});
