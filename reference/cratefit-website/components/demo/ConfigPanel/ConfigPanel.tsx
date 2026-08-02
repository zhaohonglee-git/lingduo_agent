'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Package, Radio, Settings, Play, RotateCcw, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import { BinsTab } from './BinsTab';
import { ItemsTab } from './ItemsTab';
import { OnlineTab } from './OnlineTab';
import { OptionsTab } from './OptionsTab';

type TabId = 'bins' | 'items' | 'online' | 'options';

const tabs = [
  { id: 'bins' as const, icon: Box, labelKey: 'tabs.bins' },
  { id: 'items' as const, icon: Package, labelKey: 'tabs.items' },
  { id: 'online' as const, icon: Radio, labelKey: 'tabs.online' },
  { id: 'options' as const, icon: Settings, labelKey: 'tabs.options' },
];

export function ConfigPanel() {
  const t = useTranslations('demo');
  const [activeTab, setActiveTab] = useState<TabId>('bins');
  const { runPack, reset, isPacking, autoPack, setAutoPack, mode } = useDemoStore();

  return (
    <div className="flex h-full w-full flex-col border-b bg-card lg:w-80 lg:border-b-0 lg:border-r">
      {/* Tab navigation */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-3 text-xs font-medium transition-colors hover:bg-accent',
                activeTab === tab.id
                  ? 'border-b-2 border-primary bg-accent/50 text-primary'
                  : 'border-b-2 border-transparent text-muted-foreground'
              )}
            >
              <Icon className="mb-1 h-5 w-5" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'bins' && <BinsTab />}
        {activeTab === 'items' && <ItemsTab />}
        {activeTab === 'online' && <OnlineTab />}
        {activeTab === 'options' && <OptionsTab />}
      </div>

      {/* Actions footer */}
      <div className="flex items-center gap-2 border-t p-3">
        <button
          onClick={() => setAutoPack(!autoPack)}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors',
            autoPack
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <Zap className={cn('h-3 w-3', autoPack && 'text-yellow-500')} />
          {t('autoPack')}
        </button>
        {mode === 'offline' && !autoPack && (
          <button
            onClick={runPack}
            disabled={isPacking}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPacking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('packing')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {t('pack')}
              </>
            )}
          </button>
        )}
        <button
          onClick={reset}
          className="flex shrink-0 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
