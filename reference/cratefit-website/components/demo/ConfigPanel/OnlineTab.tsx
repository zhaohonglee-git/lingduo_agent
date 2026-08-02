'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, RotateCcw, Check, X, Radio } from 'lucide-react';
import { useDemoStore } from '@/lib/stores/demo-store';
import { cn, safeParseNumber } from '@/lib/utils';

export function OnlineTab() {
  const t = useTranslations('demo');
  const {
    bins,
    mode,
    setMode,
    onlinePacker,
    onlineStats,
    onlineHistory,
    placeOnlineItem,
    resetOnlinePacker,
  } = useDemoStore();

  // Form state for new item
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(20);
  const [depth, setDepth] = useState(40);
  const [weight, setWeight] = useState(5);
  const [itemCounter, setItemCounter] = useState(1);

  const handleStartOnline = () => {
    setMode('online');
  };

  const handleStopOnline = () => {
    setMode('offline');
  };

  const handlePlace = () => {
    const item = {
      id: `online-${itemCounter}`,
      width,
      height,
      depth,
      weight,
    };
    placeOnlineItem(item);
    setItemCounter((c) => c + 1);
  };

  const handleReset = () => {
    resetOnlinePacker();
    setItemCounter(1);
  };

  // Not in online mode
  if (mode !== 'online' || !onlinePacker) {
    return (
      <div className="space-y-4">
        <div className="py-8 text-center">
          <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="mb-2 text-sm font-medium">{t('onlinePacking.title')}</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {t('onlinePacking.description')}
          </p>
          {bins.length === 0 ? (
            <p className="text-xs text-destructive">{t('onlinePacking.noBins')}</p>
          ) : (
            <button
              onClick={handleStartOnline}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              {t('onlinePacking.start')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {onlineStats && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-primary/10 p-2">
            <div className="text-lg font-semibold text-primary">{onlineStats.placedItems}</div>
            <div className="text-[10px] text-muted-foreground">{t('placed')}</div>
          </div>
          <div className="rounded-lg bg-destructive/10 p-2">
            <div className="text-lg font-semibold text-destructive">{onlineStats.rejectedItems}</div>
            <div className="text-[10px] text-muted-foreground">{t('rejected')}</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-2">
            <div className="text-lg font-semibold text-green-600">
              {(onlineStats.avgUtilization * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-muted-foreground">{t('utilization')}</div>
          </div>
        </div>
      )}

      {/* Item Input Form */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">{t('onlinePacking.nextItem')}</div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">W</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(safeParseNumber(e.target.value, 1, 1))}
              className="h-7 w-full rounded border bg-background px-1 text-xs"
              min={1}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">H</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(safeParseNumber(e.target.value, 1, 1))}
              className="h-7 w-full rounded border bg-background px-1 text-xs"
              min={1}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">D</label>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(safeParseNumber(e.target.value, 1, 1))}
              className="h-7 w-full rounded border bg-background px-1 text-xs"
              min={1}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">Kg</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(safeParseNumber(e.target.value, 0, 0))}
              className="h-7 w-full rounded border bg-background px-1 text-xs"
              min={0}
            />
          </div>
        </div>

        <button
          onClick={handlePlace}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Play className="h-4 w-4" />
          {t('onlinePacking.placeItem')}
        </button>
      </div>

      {/* History */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted-foreground">
            {t('onlinePacking.history')} ({onlineHistory.length})
          </h4>
          <div className="flex gap-1">
            <button
              onClick={handleReset}
              className="rounded p-1 text-xs text-muted-foreground hover:bg-accent"
              title={t('reset')}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              onClick={handleStopOnline}
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              {t('onlinePacking.stop')}
            </button>
          </div>
        </div>

        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {[...onlineHistory].reverse().map((entry, idx) => (
            <div
              key={onlineHistory.length - 1 - idx}
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1.5 text-xs',
                entry.result.success
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {entry.result.success ? (
                <Check className="h-3 w-3 flex-shrink-0" />
              ) : (
                <X className="h-3 w-3 flex-shrink-0" />
              )}
              <span className="font-medium">{entry.item.id}</span>
              <span className="text-muted-foreground">
                {entry.item.width}×{entry.item.height}×{entry.item.depth}
              </span>
              {entry.result.success && entry.result.binId && (
                <span className="ml-auto text-muted-foreground">{entry.result.binId}</span>
              )}
              {!entry.result.success && (
                <span className="ml-auto">{entry.result.reason}</span>
              )}
            </div>
          ))}

          {onlineHistory.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {t('onlinePacking.noHistory')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
