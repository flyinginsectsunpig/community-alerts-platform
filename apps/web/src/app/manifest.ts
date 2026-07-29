import type { MetadataRoute } from "next";

/**
 * Installability is not cosmetic here: iOS Safari only exposes the Push API to
 * web apps that have been added to the home screen, so without this manifest
 * the VAPID push subscriptions in `lib/push.ts` can never be created on iPhone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Community Alerts",
    short_name: "Alerts",
    description:
      "Real-time neighbourhood safety dashboard: report incidents, watch live alerts, and track crime hotspots.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    categories: ["news", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      // Kept separate from the icon above: Android crops maskable icons to the
      // launcher's shape, which would clip a mark drawn to the canvas edge.
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
