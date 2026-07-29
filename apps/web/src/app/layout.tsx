import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Community Alerts",
  description:
    "Real-time neighbourhood safety dashboard: report incidents, watch live alerts, and track crime hotspots.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  // Lets the layout reach the display edges so the safe-area insets in
  // globals.css resolve to real values around the notch and home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>{children}</body>
    </html>
  );
}
