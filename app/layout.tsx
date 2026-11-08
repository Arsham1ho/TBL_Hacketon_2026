import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PREFERENCES_SCRIPT } from "@/lib/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeStep",
  description: "Synthetic prototype of a digital security assistant",
  applicationName: "SafeStep",
  // Installed on iPhone and iPad: full-screen, with the SafeStep icon and name.
  appleWebApp: { capable: true, title: "SafeStep", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fi" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
