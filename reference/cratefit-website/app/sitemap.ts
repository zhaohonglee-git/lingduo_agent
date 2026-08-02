import { MetadataRoute } from "next";
import { locales } from "@/i18n/config";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => [
    {
      url: `${BASE_URL}/${locale}/demo`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
  ]);
}
