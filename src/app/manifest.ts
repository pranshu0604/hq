import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HQ — Personal Command Center",
    short_name: "HQ",
    description: "Your personal HQ — applications, work, reflections, people, gym and more.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshots/wide", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "HQ dashboard" },
      { src: "/screenshots/narrow", sizes: "720x1280", type: "image/png", form_factor: "narrow", label: "HQ dashboard" },
    ],
  };
}
