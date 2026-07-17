import { api } from "./api";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Push needs a service worker, the Push API, and a configured VAPID key. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    PUBLIC_KEY.length > 0
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** @returns false when the user declined the notification permission. */
export async function enablePush(): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return false;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return true;
}

export async function disablePush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) {
    return;
  }
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.deletePushSubscription(endpoint);
}
