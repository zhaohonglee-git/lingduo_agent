'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Package, PackageX, Box, Scale, AlertTriangle } from 'lucide-react';
import type { PackResult, PackedBin } from '@cratefit/pack';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { cn } from '@/lib/utils';

interface StatsPanelProps {
  result: PackResult;
  currentBin?: PackedBin;
}

export function StatsPanel({ result, currentBin }: StatsPanelProps) {
  const t = useTranslations('demo');
  const [showDetails, setShowDetails] = useState(false);

  const { stats, unpacked } = result;
  const utilization = stats.avgUtilization * 100;

  // Calculate total weight across all bins
  const totalWeight = result.packed.reduce((sum, bin) => sum + (bin.weight || 0), 0);

  // Calculate total cost if bins have costs
  const totalCost = result.packed.reduce((sum, bin) => {
    const binCost = bin.bin.cost ?? 0;
    return sum + binCost;
  }, 0);

  // Utilization color based on value
  const utilizationColor = utilization >= 80
    ? 'text-green-500'
    : utilization >= 60
      ? 'text-amber-500'
      : 'text-red-500';

  return (
    <div className="shrink-0 border-t bg-card">
      {/* Collapsed: Summary row with toggle button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-muted/50"
      >
        {/* Summary stats in one line */}
        <div className="flex items-center gap-4">
          <span className={cn('font-bold', utilizationColor)}>
            {utilization.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            {stats.packedItems}
          </span>
          {stats.unpackedItems > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <PackageX className="h-3.5 w-3.5" />
              {stats.unpackedItems}
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Box className="h-3.5 w-3.5" />
            {stats.totalBins}
          </span>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {showDetails ? (
            <>
              {t('hideDetails')}
              <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              {t('showDetails')}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </div>
      </button>

      {/* Expanded: Full stats */}
      {showDetails && (
        <div className="border-t p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {/* Utilization with Progress Ring */}
              <div className="flex flex-col items-center">
                <ProgressRing
                  value={utilization / 100}
                  size={56}
                  strokeWidth={5}
                  showValue={false}
                />
                <div className={cn('text-sm font-bold', utilizationColor)}>
                  {utilization.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">{t('utilization')}</div>
              </div>

              {/* Packed Items */}
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold text-primary">{stats.packedItems}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t('packed')}</div>
              </div>

              {/* Unpacked Items */}
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  <PackageX className="h-4 w-4 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">{stats.unpackedItems}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t('unpacked')}</div>
              </div>

              {/* Bins Used */}
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats.totalBins}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t('binsUsed')}</div>
              </div>

              {/* Total Weight or Cost */}
              <div className="flex flex-col items-center justify-center">
                {totalCost > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold">${totalCost.toFixed(0)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{t('cost')}</div>
                  </>
                ) : totalWeight > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{totalWeight.toFixed(1)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{t('weight')}</div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-xs text-muted-foreground">{t('weight')}</div>
                  </>
                )}
              </div>
            </div>

            {/* Unpacked Items List */}
            {unpacked.length > 0 && (
              <div className="rounded-lg border bg-destructive/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {t('rejected')} ({unpacked.length})
                  </span>
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {unpacked.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between rounded bg-background/80 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{item.id}</span>
                      <span className="text-muted-foreground">
                        {item.width}×{item.height}×{item.depth}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
