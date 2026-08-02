'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, ChevronDown, Box, Package, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import {
  DEMO_EXAMPLES,
  EXAMPLE_CATEGORIES,
  getExamplesByCategory,
  type DemoExample,
  type ExampleCategory,
} from '@/lib/demo-examples';
import { WelcomeModal } from './WelcomeModal';

interface ExampleSelectorProps {
  mode?: 'compact' | 'full';
  onSelect?: (example: DemoExample) => void;
}

export function ExampleSelector({ mode = 'compact', onSelect }: ExampleSelectorProps) {
  const t = useTranslations('demo');
  const loadConfig = useDemoStore((s) => s.loadConfig);
  const selectedExampleId = useDemoStore((s) => s.selectedExampleId);
  const [isOpen, setIsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get selected example
  const selectedExample = selectedExampleId
    ? DEMO_EXAMPLES.find((e) => e.id === selectedExampleId)
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSelect = (example: DemoExample) => {
    loadConfig(
      {
        bins: example.bins,
        items: example.items,
        options: example.options,
      },
      example.id
    );
    setIsOpen(false);
    onSelect?.(example);
  };

  const getTotalItems = (example: DemoExample) => {
    return example.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  };

  if (mode === 'full') {
    return (
      <div className="space-y-6">
        {EXAMPLE_CATEGORIES.map((category) => {
          const examples = getExamplesByCategory(category.id);
          if (examples.length === 0) return null;

          return (
            <div key={category.id}>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {t(category.nameKey)}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {examples.map((example) => {
                  const Icon = example.icon;
                  return (
                    <button
                      key={example.id}
                      onClick={() => handleSelect(example)}
                      className="group flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-accent"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t(example.nameKey)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {t(example.descriptionKey)}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            <Box className="h-3 w-3" />
                            {example.bins.length}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />
                            {getTotalItems(example)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Compact mode (dropdown)
  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent"
      >
        {selectedExample ? (
          <>
            <selectedExample.icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-left">{t(selectedExample.nameKey)}</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left">{t('selectExample')}</span>
          </>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover p-1 shadow-lg">
          {/* Browse All Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              setShowWelcome(true);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-primary hover:bg-accent"
          >
            <LayoutGrid className="h-4 w-4" />
            {t('browseAllExamples')}
          </button>
          <div className="my-1 border-t" />

          <div className="max-h-72 overflow-y-auto">
            {EXAMPLE_CATEGORIES.map((category, categoryIndex) => {
              const examples = getExamplesByCategory(category.id);
              if (examples.length === 0) return null;

              return (
                <div key={category.id}>
                  {categoryIndex > 0 && <div className="my-1 border-t" />}
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {t(category.nameKey)}
                  </div>
                  {examples.map((example) => {
                    const Icon = example.icon;
                    return (
                      <button
                        key={example.id}
                        onClick={() => handleSelect(example)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate text-left">{t(example.nameKey)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {example.bins.length}×{getTotalItems(example)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcome && <WelcomeModal forceOpen onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
