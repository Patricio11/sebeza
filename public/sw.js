/**
 * Phase 28 — minimal, safe service worker.
 *
 * Deliberately does ONE thing: when a page navigation fails because the
 * device is offline, serve the pre-cached /offline.html instead of the
 * browser error page. It never caches application pages or data, so it
 * can never serve stale content, break auth, or fight deployments.
 * (No-Flash: the SW itself is ~1KB and adds zero JS to page loads.)
 */
const CACHE = "sebenza-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Navigations only — assets/API requests pass straight through untouched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
