import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Breeze",
    short_name: "Breeze",
    description: "Clear notes for every conversation.",
    start_url: "/meetings",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
  };
}
