import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ivannaura.vercel.app",
      lastModified: new Date("2026-04-05"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
