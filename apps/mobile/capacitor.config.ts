import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app is a native shell around the deployed site rather than a bundled
 * copy of it. The site's API URL and map key are baked in at its own build, it
 * already has CORS for its own origin, and a web deploy reaches the app without
 * a new release through Google Play.
 */
const config: CapacitorConfig = {
  // Permanent once published: Google Play identifies the app by this.
  appId: "com.communityalerts.app",
  appName: "Community Alerts",
  // Only the offline screen ships inside the app.
  webDir: "www",
  server: {
    url: "https://web.purpleflower-fcabaa8f.southafricanorth.azurecontainerapps.io",
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
