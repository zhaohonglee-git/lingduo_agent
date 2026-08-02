'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Trophy, Clock, Loader2, X } from 'lucide-react';
import { pack, type PackResult, type AlgorithmType } from '@cratefit/pack';
import { cn } from '@/lib/utils';
import { useDemoStore, type DemoItem } from '@/lib/stores/demo-store';
import { ProgressRing } from '@/components/ui/ProgressRing';

interface AlgorithmResult {
  algorithm: AlgorithmType;
  result: PackResult | null;
  duration: number;
  error?: string;
}

const ALGORITHMS: { id: AlgorithmType; nameKey: string }[] = [
  { id: 'extreme-point', nameKey: 'algorithms.extremePoint.name' },
  { id: 'layer-building', nameKey: 'algorithms.layerBuilding.name' },
  { id: 'wall-building', nameKey: 'algorithms.wallBuilding.name' },
  { id: 'eb-afit', nameKey: 'algorithms.ebAfit.name' },
];

// Helper to expand items with quantity
const expandItems = (items: DemoItem[]) => {
  const expanded = [];
  for (const item of items) {
    const qty = item.quantity || 1;
    for (let i = 0; i < qty; i++) {
      const { quantity, color, ...itemSpec } = item;
      expanded.push({
        ...itemSpec,
        id: qty > 1 ? `${item.id}-${i + 1}` : item.id,
        metadata: { color },
      });
    }
  }
  return expanded;
};

interface AlgorithmComparisonProps {
  onClose: () => void;
}

export function AlgorithmComparison({ onClose }: AlgorithmComparisonProps) {
  const t = useTranslations('demo');
  const { bins, items, options } = useDemoStore();
  const [results, setResults] = useState<AlgorithmResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [randomBaseline, setRandomBaseline] = useState<number | null>(null);

  const runComparison = useCallback(async () => {
    if (bins.length === 0 || items.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setRandomBaseline(null); // Clear previous baseline to free memory

    const expandedItems = expandItems(items);

    // Run each algorithm sequentially to get accurate timing
    // Use functional state updates to avoid intermediate array accumulation
    for (const algo of ALGORITHMS) {
      const start = performance.now();
      try {
        const result = pack({
          bins,
          items: expandedItems,
          options: {
            ...options,
            algorithm: algo.id,
            timeBudgetMs: algo.id === 'eb-afit' ? 3000 : undefined,
          },
        });
        const duration = performance.now() - start;
        // Functional update avoids keeping intermediate array in memory
        setResults((prev) => [...prev, { algorithm: algo.id, result, duration }]);
      } catch (error) {
        const duration = performance.now() - start;
        setResults((prev) => [...prev, {
          algorithm: algo.id,
          result: null,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        }]);
      }
      // Small delay for visual effect
      await new Promise((r) => setTimeout(r, 100));
    }

    // Calculate random baseline (average utilization if items were randomly distributed)
    const totalItemVolume = expandedItems.reduce(
      (sum, item) => sum + item.width * item.height * item.depth,
      0
    );
    const firstBin = bins[0];
    if (firstBin) {
      const binVolume = firstBin.width * firstBin.height * firstBin.depth;
      const baseline = Math.min(totalItemVolume / binVolume, 1);
      setRandomBaseline(baseline);
    }

    setIsRunning(false);
  }, [bins, items, options]);

  // Find best result
  const bestResult = results.reduce<AlgorithmResult | null>((best, curr) => {
    if (!curr.result) return best;
    if (!best?.result) return curr;
    return curr.result.stats.avgUtilization > best.result.stats.avgUtilization ? curr : best;
  }, null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('comparison.title')}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Run Button */}
          <div className="mb-6 flex items-center gap-4">
            <button
              onClick={runComparison}
              disabled={isRunning || bins.length === 0 || items.length === 0}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('comparison.running')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {t('comparison.runAll')}
                </>
              )}
            </button>
            {randomBaseline !== null && (
              <div className="text-sm text-muted-foreground">
                {t('comparison.randomBaseline')}: {(randomBaseline * 100).toFixed(1)}%
              </div>
            )}
          </div>

          {/* Results Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {ALGORITHMS.map((algo) => {
              const result = results.find((r) => r.algorithm === algo.id);
              const isBest = bestResult?.algorithm === algo.id && results.length === ALGORITHMS.length;
              const utilization = result?.result?.stats.avgUtilization ?? 0;
              const improvement = randomBaseline
                ? ((utilization - randomBaseline) / randomBaseline) * 100
                : null;

              return (
                <div
                  key={algo.id}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    isBest && 'border-yellow-500 bg-yellow-500/5'
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t(algo.nameKey)}</span>
                      {isBest && <Trophy className="h-4 w-4 text-yellow-500" />}
                    </div>
                    {result && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {result.duration.toFixed(0)}ms
                      </div>
                    )}
                  </div>

                  {result ? (
                    result.error ? (
                      <div className="text-sm text-destructive">{result.error}</div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ProgressRing value={utilization} size={64} />
                        <div className="flex-1 space-y-1">
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('packed')}: </span>
                            <span className="font-medium">
                              {result.result?.stats.packedItems ?? 0}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t('unpacked')}: </span>
                            <span className="font-medium">
                              {result.result?.stats.unpackedItems ?? 0}
                            </span>
                          </div>
                          {improvement !== null && (
                            <div className="text-xs">
                              <span
                                className={cn(
                                  'font-medium',
                                  improvement > 0 ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {improvement > 0 ? '+' : ''}
                                {improvement.toFixed(1)}%
                              </span>
                              <span className="text-muted-foreground">
                                {' '}
                                {t('comparison.vsBaseline')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-16 items-center justify-center text-muted-foreground">
                      {isRunning ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <span className="text-sm">{t('comparison.notRun')}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
