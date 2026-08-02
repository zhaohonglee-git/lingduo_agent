import { MetadataRoute } from "next";
import { getAllDocsAllLocales } from "@/lib/docs";
import { locales } from "@/i18n/config";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://cratefit.vercel.app";

type SitemapEntry = MetadataRoute.Sitemap[number];

function createAlternates(path: string) {
  return {
    languages: Object.fromEntries(
      locales.map((locale) => [locale, `${BASE_URL}/${locale}${path}`])
    ),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const allDocs = getAllDocsAllLocales();

  // Static pages for each locale with alternates
  const staticPages: SitemapEntry[] = locales.flatMap((locale) => [
    {
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: createAlternates(""),
    },
    {
      url: `${BASE_URL}/${locale}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: createAlternates("/docs"),
    },
    {
      url: `${BASE_URL}/${locale}/demo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: createAlternates("/demo"),
    },
    {
      url: `${BASE_URL}/${locale}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: createAlternates("/pricing"),
    },
  ]);

  // Doc pages for each locale with alternates
  const docRoutes: SitemapEntry[] = allDocs.map((doc) => {
    const path = doc.slug.length > 0 ? `/docs/${doc.slug.join("/")}` : "/docs";
    return {
      url: `${BASE_URL}/${doc.locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: createAlternates(path),
    };
  });

  return [...staticPages, ...docRoutes];
}
