'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <h1 className="text-6xl font-bold">{t('title')}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
        <Link
          href="/"
          className="mt-8 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('backHome')}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
