'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useSyncExternalStore } from 'react';

// Use useSyncExternalStore for hydration-safe mounted state
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('theme');
  // Hydration-safe check using useSyncExternalStore
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <button className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const getNextTheme = () => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'system';
    return 'light';
  };

  const nextTheme = getNextTheme();

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="flex h-9 w-9 items-center justify-center rounded-md border bg-background transition-colors hover:bg-accent"
      title={t('switchTo', { mode: t(nextTheme) })}
    >
      {theme === 'light' && <Sun className="h-4 w-4" />}
      {theme === 'dark' && <Moon className="h-4 w-4" />}
      {theme === 'system' && <Monitor className="h-4 w-4" />}
    </button>
  );
}
