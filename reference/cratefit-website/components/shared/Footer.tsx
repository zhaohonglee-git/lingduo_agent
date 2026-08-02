'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Github } from 'lucide-react';
import { Logo } from './Logo';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const footerLinks = {
    product: [
      { name: tNav('docs'), href: '/docs' },
      { name: tNav('demo'), href: '/demo' },
      { name: tNav('pricing'), href: '/pricing' },
    ],
    resources: [
      { name: t('apiReference'), href: '/docs/api-reference' },
    ],
    community: [
      { name: 'GitHub', href: 'https://github.com/supra126/cratefit-starter' },
      { name: 'npm', href: 'https://www.npmjs.com/package/@cratefit/pack' },
    ],
  };

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              {t('description')}
            </p>
            <div className="mt-4 flex gap-4">
              <a
                href="https://github.com/supra126/cratefit-starter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('product')}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('resources')}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t('community')}</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CrateFit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
