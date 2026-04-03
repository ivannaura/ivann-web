import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ivannaura.com",
      lastModified: new Date("2026-04-02"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
