'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Zap, Settings } from 'lucide-react';
import { ExampleSelector } from './ExampleSelector';
import type { DemoExample } from '@/lib/demo-examples';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/storage';

const WELCOME_SHOWN_KEY = 'cratefit-demo-welcome-shown';

interface WelcomeModalProps {
  onClose?: () => void;
  forceOpen?: boolean;
}

export function WelcomeModal({ onClose, forceOpen }: WelcomeModalProps) {
  const t = useTranslations('demo');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // Check if modal was already shown (using safe localStorage wrapper)
    const hasBeenShown = safeGetItem(WELCOME_SHOWN_KEY);
    if (!hasBeenShown) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    setIsOpen(false);
    if (!forceOpen) {
      safeSetItem(WELCOME_SHOWN_KEY, 'true');
    }
    onClose?.();
  };

  const handleExampleSelect = (example: DemoExample) => {
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('welcome.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('welcome.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-12rem)] overflow-y-auto px-6 py-4">
          {/* Quick Tips */}
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4" />
              {t('welcome.tips.title')}
            </h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• {t('welcome.tips.autopack')}</li>
              <li>• {t('welcome.tips.viewer')}</li>
              <li>• {t('welcome.tips.export')}</li>
            </ul>
          </div>

          {/* Example Selector */}
          <div>
            <h3 className="mb-3 text-sm font-medium">{t('welcome.selectExample')}</h3>
            <ExampleSelector mode="full" onSelect={handleExampleSelect} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              defaultChecked
              onChange={(e) => {
                if (!e.target.checked) {
                  safeRemoveItem(WELCOME_SHOWN_KEY);
                } else {
                  safeSetItem(WELCOME_SHOWN_KEY, 'true');
                }
              }}
              className="rounded border"
            />
            {t('welcome.dontShowAgain')}
          </label>
          <button
            onClick={handleClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('welcome.startExploring')}
          </button>
        </div>
      </div>
    </div>
  );
}
