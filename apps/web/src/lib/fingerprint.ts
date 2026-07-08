const STORAGE_KEY = "community-alerts-fingerprint";

/**
 * Stable anonymous identity for rate limiting and duplicate-confirmation
 * checks. Random, stored locally, and never tied to personal data.
 */
export function getFingerprint(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  let fingerprint = window.localStorage.getItem(STORAGE_KEY);
  if (!fingerprint) {
    fingerprint = crypto.randomUUID().replace(/-/g, "");
    window.localStorage.setItem(STORAGE_KEY, fingerprint);
  }
  return fingerprint;
}
