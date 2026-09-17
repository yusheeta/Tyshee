import type { MetadataRoute } from "next";
import { COLLECTIONS } from "@/data/collections";
import { STORIES } from "@/data/journal";
import { getAllProducts } from "@/lib/products";
import { SITE_URL } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/colour-analysis`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/journal`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...COLLECTIONS.map((c) => ({ url: `${SITE_URL}/collections/${c.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...getAllProducts().map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, lastModified: new Date(p.createdAt), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...STORIES.map((s) => ({ url: `${SITE_URL}/journal/${s.slug}`, lastModified: new Date(s.date), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
