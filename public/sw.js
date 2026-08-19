// D-Maths PWA service worker. Gives the installed app an offline shell and
// makes it installable. Pages use network-first (data stays fresh; the cached
// copy is only a fallback when the phone is offline); static assets are
// cache-first. API and auth requests are never cached.
const CACHE = "dmaths-v1";
const FALLBACK = "/dashboard";
const PRECACHE = ["/dashboard", "/login", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase/DeepSeek/Resend
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Pages: network-first, fall back to cache (then the dashboard) when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match(FALLBACK)),
        ),
    );
    return;
  }

  // Static assets: cache-first, populate the cache on first fetch.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const cacheable = ["image", "style", "script", "font"].includes(
              request.destination,
            );
            if (res.ok && cacheable) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => cached),
    ),
  );
});
