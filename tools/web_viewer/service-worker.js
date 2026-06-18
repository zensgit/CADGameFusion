const CACHE_NAME = "cadgf-web-viewer-v3";
const PRODUCT_OFFLINE_CACHE_NAME = "cadgf-product-offline-v1";
const PRODUCT_OFFLINE_MESSAGE_TYPE = "VEMCAD_CACHE_PRODUCT_OFFLINE_ASSETS";
const ACTIVE_CACHE_NAMES = new Set([CACHE_NAME, PRODUCT_OFFLINE_CACHE_NAME]);
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./legacy_app_bootstrap.js",
  "./manifest.webmanifest",
  "./assets/icon.svg"
];

function normalizeProductOfflineAsset(asset) {
  const value = String(asset || "").trim();
  if (!value) {
    throw new Error("Empty product offline asset");
  }

  const url = new URL(value, self.location.origin);
  if (url.origin !== self.location.origin) {
    throw new Error(`Product offline asset must be same-origin: ${value}`);
  }
  return url.toString();
}

async function cacheProductOfflineAssets(assets) {
  if (!Array.isArray(assets)) {
    throw new Error("Product offline assets payload must be an array");
  }

  const urls = [...new Set(assets.map(normalizeProductOfflineAsset))];
  const cache = await caches.open(PRODUCT_OFFLINE_CACHE_NAME);
  const results = await Promise.allSettled(
    urls.map((url) => cache.add(new Request(url, { credentials: "same-origin" })))
  );
  const failed = results
    .map((result, index) => ({ result, url: urls[index] }))
    .filter((entry) => entry.result.status === "rejected")
    .map((entry) => ({
      url: entry.url,
      error: String(entry.result.reason?.message || entry.result.reason || "cache failed")
    }));

  if (failed.length > 0) {
    throw new Error(`Failed to cache ${failed.length} product offline asset(s): ${failed[0].url}`);
  }

  return {
    cacheName: PRODUCT_OFFLINE_CACHE_NAME,
    assetCount: urls.length,
    cachedCount: urls.length
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !ACTIVE_CACHE_NAMES.has(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== PRODUCT_OFFLINE_MESSAGE_TYPE) return;
  const replyPort = event.ports?.[0] || null;
  event.waitUntil(
    cacheProductOfflineAssets(event.data.assets)
      .then((result) => {
        replyPort?.postMessage({ ok: true, ...result });
      })
      .catch((error) => {
        replyPort?.postMessage({
          ok: false,
          cacheName: PRODUCT_OFFLINE_CACHE_NAME,
          error: String(error?.message || error)
        });
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
