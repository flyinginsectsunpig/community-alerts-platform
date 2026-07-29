import { api } from "./api";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Push needs a service worker, the Push API, and a configured VAPID key. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    // Safari withholds Notification outside installed web apps, so checking
    // for PushManager alone is not enough to know requestPermission exists.
    "Notification" in window &&
    PUBLIC_KEY.length > 0
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ claims to be a Mac, so touch points are what separate them.
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own pre-standard flag for home-screen web apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS grants the Push API only to web apps launched from the home screen, so a
 * plain Safari tab reports no support even though the device is capable. The
 * caller uses this to explain the install step instead of hiding the control.
 */
export function needsInstallForPush(): boolean {
  return !pushSupported() && isIos() && !isStandalone() && PUBLIC_KEY.length > 0;
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
  if (!pushSupported()) {
    throw new Error("Push is not available in this browser");
  }
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
