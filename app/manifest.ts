import type { MetadataRoute } from "next";

// Makes SafeStep installable as an app on phones, tablets and desktops.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SafeStep: What should I do now?",
    short_name: "SafeStep",
    description: "Clear next steps when something looks like a scam or a security problem. Synthetic prototype, not a live DNA service.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "fi",
    categories: ["security", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
