import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

const handleI18nRouting = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export function proxy(request: NextRequest) {
  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    // Skip static files and API routes
    '/((?!api|_next|_vercel|.*\\..*|icon|apple-icon|favicon|og-image|manifest|robots|sitemap).*)',
  ],
};
