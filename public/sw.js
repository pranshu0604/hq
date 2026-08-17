// Minimal service worker — makes HQ installable (Chrome/Edge "Install", Safari "Add to Dock").
// HQ is a live, DB-backed app, so we don't cache dynamic data; navigations just fall back
// to a friendly offline message when the local server isn't running.
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HQ — offline</title>
<style>html{background:#0f1115;color:#f2f0eb;font-family:system-ui,sans-serif;height:100%}
body{height:100%;margin:0;display:grid;place-items:center;text-align:center}
.b{width:56px;height:56px;border-radius:14px;background:linear-gradient(150deg,#dc9a58,#b77932);color:#2a1608;
display:grid;place-items:center;font-weight:800;font-size:22px;margin:0 auto 18px}
h1{font-size:20px;margin:0 0 6px}p{color:#aeb4bf;font-size:14px;max-width:320px}</style>
<div><div class="b">HQ</div><h1>HQ is offline</h1><p>Start the local server, then reopen HQ.</p></div>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ---- web push ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "HQ";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: data.tag || "hq",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          if ("navigate" in w) w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // let everything else pass through
  event.respondWith(
    fetch(req).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
