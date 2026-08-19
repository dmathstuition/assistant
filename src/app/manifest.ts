import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest) that makes D-Maths
// installable to a phone home screen as a standalone PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "D-Maths Assistant",
    short_name: "D-Maths",
    description: "Personal productivity & finance assistant",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    categories: ["finance", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Home-screen shortcuts (long-press the installed icon).
    shortcuts: [
      { name: "Add expense", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Planner", url: "/planner", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Income", url: "/income", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
