import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KillerPitch",
    short_name: "KillerPitch",
    description: "Rehearse any speech or pitch up to 5 minutes, on your own rhythm.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f0e9",
    theme_color: "#1746ff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}
