'use client';

import { useTranslations } from 'next-intl';
import { Box, Package, Scale, Layers } from 'lucide-react';
import { useDemoStore } from '@/lib/stores/demo-store';
import type { PlacedItem, BinSpec } from '@cratefit/pack';

interface HoverInfoCardProps {
  position: { x: number; y: number };
  item?: PlacedItem;
  bin?: BinSpec;
}

export function HoverInfoCard({ position, item, bin }: HoverInfoCardProps) {
  const t = useTranslations('demo');

  if (!item && !bin) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
      style={{
        left: position.x + 12,
        top: position.y + 12,
        maxWidth: 250,
      }}
    >
      {item && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-medium">{item.item.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Box className="h-3 w-3" />
              {t('hoverInfo.dimensions')}
            </div>
            <div>
              {item.item.width} × {item.item.height} × {item.item.depth}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Layers className="h-3 w-3" />
              {t('hoverInfo.position')}
            </div>
            <div>
              ({item.position.x.toFixed(0)}, {item.position.y.toFixed(0)}, {item.position.z.toFixed(0)})
            </div>
            {item.item.weight && (
              <>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Scale className="h-3 w-3" />
                  {t('weight')}
                </div>
                <div>{item.item.weight}</div>
              </>
            )}
            {item.item.groupId && (
              <>
                <div className="text-muted-foreground">{t('groupId')}</div>
                <div>{item.item.groupId}</div>
              </>
            )}
          </div>
        </div>
      )}

      {bin && !item && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            <span className="font-medium">{bin.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="text-muted-foreground">{t('hoverInfo.dimensions')}</div>
            <div>
              {bin.width} × {bin.height} × {bin.depth}
            </div>
            {bin.maxWeight && (
              <>
                <div className="text-muted-foreground">{t('maxWeight')}</div>
                <div>{bin.maxWeight}</div>
              </>
            )}
            {bin.type && (
              <>
                <div className="text-muted-foreground">{t('containerType')}</div>
                <div>{t(`containerTypes.${bin.type}`)}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
