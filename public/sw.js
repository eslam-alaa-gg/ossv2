// LIFE OS service worker: Web Push delivery + notification click handling (no offline caching).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = { title: "LIFE OS", body: "", href: "/dashboard" };
  try { data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", badge: "/icon.svg", data: { href: data.href || "/dashboard" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => { for (const c of cs) { if ("focus" in c) { c.navigate(href); return c.focus(); } } return self.clients.openWindow(href); }));
});
