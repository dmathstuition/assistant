import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest) that makes D-Maths
// installable to a phone home screen as a standalone PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "D-Maths Assistant",
    short_name: "D-Maths",
    description: "Personal productivity & finance assistant",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
