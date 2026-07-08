import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Community Alerts",
  description:
    "Real-time neighbourhood safety dashboard: report incidents, watch live alerts, and track crime hotspots.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
