import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeHub",
    short_name: "LifeHub",
    description: "Bills, calendar, travel, sport, deals and health in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0d10",
    theme_color: "#0c0d10",
    icons: [
      { src: "/icons/icon-192.png?v=lh", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png?v=lh", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png?v=lh", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
