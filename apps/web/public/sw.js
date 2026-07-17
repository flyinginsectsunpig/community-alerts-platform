// Service worker for watch-zone push notifications. The payload shape
// ({title, body, alertId}) is produced by the worker's WebPushSender
// (services/alert-processor/src/AlertProcessor/Notifications/PushSender.cs).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Malformed payload — show a generic notification rather than nothing.
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Community Alerts", {
      body: data.body ?? "New activity in one of your watch zones.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { alertId: data.alertId ?? null },
      tag: data.alertId ? `alert-${data.alertId}` : undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => "focus" in w);
      return existing ? existing.focus() : clients.openWindow("/");
    }),
  );
});
