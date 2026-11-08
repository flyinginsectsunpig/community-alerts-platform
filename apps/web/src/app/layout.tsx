import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import "./globals.css";

// Drawn from the plates and highway signs of California: type made to be read
// quickly, outdoors, by someone with other things on their mind.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-condensed",
});

export const metadata: Metadata = {
  title: "Community Alerts",
  description:
    "Real-time neighbourhood safety dashboard: report incidents, watch live alerts, and track crime hotspots.",
  applicationName: "Community Alerts",
  // iOS reads these rather than the manifest when the app is added to the home
  // screen, which is the only context where it grants the Push API.
  appleWebApp: {
    capable: true,
    title: "Alerts",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Matches --page in globals.css for each scheme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#090a0e" },
  ],
  // Lets the layout reach the display edges so the safe-area insets in
  // globals.css resolve to real values around the notch and home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
