'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Languages } from 'lucide-react';
import { locales, type Locale } from '@/i18n/config';

const localeNames: Record<Locale, string> = {
  en: 'EN',
  'zh-TW': '中',
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('language');

  const switchLocale = () => {
    const currentIndex = locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % locales.length;
    const nextLocale = locales[nextIndex];

    if (!nextLocale) return; // TypeScript guard for noUncheckedIndexedAccess
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={switchLocale}
      className="flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-accent"
      title={t('switchLanguage')}
    >
      <Languages className="h-4 w-4" />
      <span>{localeNames[locale]}</span>
    </button>
  );
}
