import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { locales, defaultLocale, type Locale } from "@/i18n/config";

const contentDirectory = path.join(process.cwd(), "content/docs");

// Maximum content size for documentation files (500KB)
// This is a defense-in-depth measure to catch accidentally large files early
const MAX_DOC_SIZE = 500000;

// Sanitize slug segments to prevent path traversal attacks
function sanitizeSlugSegment(segment: string): string {
  // Only allow alphanumeric, hyphens, and underscores
  return segment.replace(/[^a-zA-Z0-9-_]/g, "");
}

function getDocsDirectory(locale: string): string {
  // Validate locale, fallback to default
  const validLocale = locales.includes(locale as Locale)
    ? locale
    : defaultLocale;
  return path.join(contentDirectory, validLocale);
}

export interface DocMeta {
  slug: string[];
  title: string;
  description?: string;
  order?: number;
}

export interface Doc extends DocMeta {
  content: string;
}

export function getDocBySlug(slug: string[], locale: string): Doc | null {
  // Sanitize slug segments to prevent path traversal
  const sanitizedSlug = slug.map(sanitizeSlugSegment).filter(Boolean);

  // Reject if sanitization changed the slug (potential attack)
  if (sanitizedSlug.length !== slug.length ||
      sanitizedSlug.some((s, i) => s !== slug[i])) {
    return null;
  }

  const docsDirectory = getDocsDirectory(locale);
  const slugPath = sanitizedSlug.join("/");
  const fullPath = path.join(docsDirectory, `${slugPath}.mdx`);
  const indexPath = path.join(docsDirectory, slugPath, "index.mdx");

  // Ensure resolved path is within docs directory (prevent path traversal)
  const resolvedFull = path.resolve(fullPath);
  const resolvedIndex = path.resolve(indexPath);
  const resolvedDocsDir = path.resolve(docsDirectory);

  let filePath: string;
  if (resolvedFull.startsWith(resolvedDocsDir) && fs.existsSync(fullPath)) {
    filePath = fullPath;
  } else if (resolvedIndex.startsWith(resolvedDocsDir) && fs.existsSync(indexPath)) {
    filePath = indexPath;
  } else {
    // Fallback to default locale if not found
    if (locale !== defaultLocale) {
      return getDocBySlug(slug, defaultLocale);
    }
    return null;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");

  // Server-side size check - fail fast before sending large content to client
  if (fileContents.length > MAX_DOC_SIZE) {
    console.error(`Documentation file too large (${fileContents.length} bytes): ${filePath}`);
    return null;
  }

  const { data, content } = matter(fileContents);

  return {
    slug: sanitizedSlug,
    title: data.title || sanitizedSlug[sanitizedSlug.length - 1] || "Documentation",
    description: data.description,
    order: data.order,
    content,
  };
}

export function getAllDocs(locale: string): DocMeta[] {
  const docsDirectory = getDocsDirectory(locale);
  const docs: DocMeta[] = [];

  function walkDir(dir: string, baseSlug: string[] = []) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath, [...baseSlug, file]);
      } else if (file.endsWith(".mdx")) {
        const slug =
          file === "index.mdx"
            ? baseSlug
            : [...baseSlug, file.replace(".mdx", "")];
        const fileContents = fs.readFileSync(filePath, "utf8");
        const { data } = matter(fileContents);

        docs.push({
          slug,
          title: data.title || slug[slug.length - 1] || "Documentation",
          description: data.description,
          order: data.order,
        });
      }
    }
  }

  walkDir(docsDirectory);
  return docs;
}

// Get all docs for all locales (for generateStaticParams)
export function getAllDocsAllLocales(): { slug: string[]; locale: string }[] {
  const results: { slug: string[]; locale: string }[] = [];

  for (const locale of locales) {
    const docs = getAllDocs(locale);
    for (const doc of docs) {
      results.push({ slug: doc.slug, locale });
    }
  }

  return results;
}

export interface NavItem {
  title: string;
  href: string;
  items?: NavItem[];
  order?: number;
}

export function getDocsNavigation(locale: string): NavItem[] {
  const docs = getAllDocs(locale);

  // Group docs by first slug segment
  const grouped = new Map<string, DocMeta[]>();

  for (const doc of docs) {
    if (doc.slug.length === 0) {
      const existing = grouped.get("") || [];
      grouped.set("", [...existing, doc]);
    } else {
      const firstSlug = doc.slug[0];
      if (firstSlug === undefined) continue; // TypeScript guard
      const existing = grouped.get(firstSlug) || [];
      grouped.set(firstSlug, [...existing, doc]);
    }
  }

  const nav: NavItem[] = [];

  // Root level docs (e.g., getting-started)
  const rootDocs = grouped.get("") || [];
  for (const doc of rootDocs) {
    nav.push({
      title: doc.title,
      href: "/docs",
      order: doc.order,
    });
  }

  // Grouped docs
  for (const [section, sectionDocs] of grouped) {
    if (section === "") continue;

    const items = sectionDocs
      .filter((doc) => doc.slug.length > 1)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      .map((doc) => ({
        title: doc.title,
        href: `/docs/${doc.slug.join("/")}`,
        order: doc.order,
      }));

    // Find section index doc
    const indexDoc = sectionDocs.find((doc) => doc.slug.length === 1);

    nav.push({
      title: indexDoc?.title || section.replace(/-/g, " "),
      href: `/docs/${section}`,
      items: items.length > 0 ? items : undefined,
      order: indexDoc?.order,
    });
  }

  return nav.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
