import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tu Tiên Giới",
    short_name: "TTG",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1210",
    theme_color: "#0d1210",
    icons: []
  };
}
