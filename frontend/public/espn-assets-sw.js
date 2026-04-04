/**
 * Caches ESPN CDN logo images (team + league) after first load so repeat views
 * don't re-hit a.espncdn.com for the same URLs.
 */
const CACHE_NAME = "matcharr-espn-logos-v1";
const ESPN_HOST = "a.espncdn.com";

function isEspnLogoRequest(url) {
  if (url.hostname !== ESPN_HOST) return false;
  return (
    url.pathname.includes("/teamlogos/") ||
    url.pathname.startsWith("/combiner/")
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key.startsWith("matcharr-espn-") && key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isEspnLogoRequest(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") {
          try {
            await cache.put(event.request, response.clone());
          } catch {
            /* quota / opaque edge cases — still return network response */
          }
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    }),
  );
});
