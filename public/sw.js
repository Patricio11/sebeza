/**
 * Phase 28  minimal, safe service worker.
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
  // Navigations only  assets/API requests pass straight through untouched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

/**
 * Phase 35  Web Push.
 *
 * The payload is deliberately thin (title, body, a RELATIVE path, and a
 * collapse tag) because a notification renders on a lock screen anyone
 * holding the phone can read. Everything personal stays behind the tap.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title
    ? data.title
    : "Sebenza";
  const body = typeof data.body === "string" ? data.body : "";
  // Same-origin only. A payload that tries to send the user off-site
  // (or to a protocol-relative "//evil.example") is ignored in favour
  // of the dashboard.
  const path =
    typeof data.path === "string" &&
    data.path.startsWith("/") &&
    !data.path.startsWith("//")
      ? data.path
      : "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      // Same tag replaces rather than stacks, so five invitations do
      // not bury the phone under five separate notifications.
      tag: typeof data.tag === "string" ? data.tag : "sebenza",
      renotify: true,
      data: { path },
    }),
  );
});

/**
 * Tapping focuses an already-open Sebenza tab and navigates it, rather
 * than piling up duplicates. Only opens a new window if none is open.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/dashboard";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then((c) => (c.navigate ? c.navigate(target) : c));
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
