'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2, Box } from 'lucide-react';
import { safeParseNumber } from '@/lib/utils';
import type { AABB } from '@cratefit/pack';

// Preset irregular container shapes
const IRREGULAR_PRESETS: Record<string, { excludeZones: AABB[]; label: string }> = {
  lShape: {
    label: 'L-Shape',
    excludeZones: [
      { minX: 50, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 50 },
    ],
  },
  step: {
    label: 'Step',
    excludeZones: [
      { minX: 50, maxX: 100, minY: 50, maxY: 100, minZ: 0, maxZ: 100 },
    ],
  },
  pillar: {
    label: 'Pillar (corner)',
    excludeZones: [
      { minX: 0, maxX: 15, minY: 0, maxY: 100, minZ: 0, maxZ: 15 },
    ],
  },
  uShape: {
    label: 'U-Shape',
    excludeZones: [
      { minX: 33, maxX: 66, minY: 0, maxY: 100, minZ: 33, maxZ: 100 },
    ],
  },
};

interface ExcludeZonesEditorProps {
  zones: AABB[];
  binWidth: number;
  binHeight: number;
  binDepth: number;
  onChange: (zones: AABB[]) => void;
}

export function ExcludeZonesEditor({
  zones,
  binWidth,
  binHeight,
  binDepth,
  onChange,
}: ExcludeZonesEditorProps) {
  const t = useTranslations('demo');

  const addZone = () => {
    const newZone: AABB = {
      minX: 0,
      maxX: Math.floor(binWidth / 4),
      minY: 0,
      maxY: Math.floor(binHeight / 2),
      minZ: 0,
      maxZ: Math.floor(binDepth / 4),
    };
    onChange([...zones, newZone]);
  };

  const updateZone = (index: number, updates: Partial<AABB>) => {
    const newZones = [...zones];
    const zone = newZones[index];
    if (zone) {
      const updatedZone = { ...zone, ...updates };

      // Ensure values are within bin bounds
      updatedZone.minX = Math.max(0, Math.min(updatedZone.minX, binWidth));
      updatedZone.maxX = Math.max(0, Math.min(updatedZone.maxX, binWidth));
      updatedZone.minY = Math.max(0, Math.min(updatedZone.minY, binHeight));
      updatedZone.maxY = Math.max(0, Math.min(updatedZone.maxY, binHeight));
      updatedZone.minZ = Math.max(0, Math.min(updatedZone.minZ, binDepth));
      updatedZone.maxZ = Math.max(0, Math.min(updatedZone.maxZ, binDepth));

      // Ensure max >= min for valid AABB geometry
      if (updatedZone.minX > updatedZone.maxX) updatedZone.maxX = updatedZone.minX;
      if (updatedZone.minY > updatedZone.maxY) updatedZone.maxY = updatedZone.minY;
      if (updatedZone.minZ > updatedZone.maxZ) updatedZone.maxZ = updatedZone.minZ;

      newZones[index] = updatedZone;
      onChange(newZones);
    }
  };

  const removeZone = (index: number) => {
    onChange(zones.filter((_, i) => i !== index));
  };

  const applyPreset = (presetKey: string) => {
    const preset = IRREGULAR_PRESETS[presetKey];
    if (!preset) return;

    // Scale preset zones to current bin dimensions
    const scaledZones = preset.excludeZones.map((zone) => ({
      minX: Math.round((zone.minX / 100) * binWidth),
      maxX: Math.round((zone.maxX / 100) * binWidth),
      minY: Math.round((zone.minY / 100) * binHeight),
      maxY: Math.round((zone.maxY / 100) * binHeight),
      minZ: Math.round((zone.minZ / 100) * binDepth),
      maxZ: Math.round((zone.maxZ / 100) * binDepth),
    }));
    onChange(scaledZones);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          <Box className="mr-1 inline-block h-3 w-3" />
          {t('bins.excludeZones')} ({zones.length})
        </label>
        <button
          onClick={addZone}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          {t('add')}
        </button>
      </div>

      {/* Presets */}
      {zones.length === 0 && (
        <div className="rounded border border-dashed p-2">
          <p className="mb-2 text-xs text-muted-foreground">{t('bins.irregularPresets')}</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(IRREGULAR_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="rounded border px-2 py-1 text-xs hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone list */}
      {zones.map((zone, index) => (
        <div key={index} className="rounded border bg-muted/30 p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">Zone {index + 1}</span>
            <button
              onClick={() => removeZone(index)}
              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                value={zone.minX}
                onChange={(e) => updateZone(index, { minX: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={0}
                max={zone.maxX}
                placeholder="minX"
                title="Min X"
              />
              <input
                type="number"
                value={zone.maxX}
                onChange={(e) => updateZone(index, { maxX: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={zone.minX}
                max={binWidth}
                placeholder="maxX"
                title="Max X"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                value={zone.minY}
                onChange={(e) => updateZone(index, { minY: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={0}
                max={zone.maxY}
                placeholder="minY"
                title="Min Y"
              />
              <input
                type="number"
                value={zone.maxY}
                onChange={(e) => updateZone(index, { maxY: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={zone.minY}
                max={binHeight}
                placeholder="maxY"
                title="Max Y"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <input
                type="number"
                value={zone.minZ}
                onChange={(e) => updateZone(index, { minZ: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={0}
                max={zone.maxZ}
                placeholder="minZ"
                title="Min Z"
              />
              <input
                type="number"
                value={zone.maxZ}
                onChange={(e) => updateZone(index, { maxZ: safeParseNumber(e.target.value, 0, 0) })}
                className="h-6 rounded border bg-card px-1 text-center"
                min={zone.minZ}
                max={binDepth}
                placeholder="maxZ"
                title="Max Z"
              />
            </div>
            <div className="flex items-center justify-center text-muted-foreground">
              X / Y / Z
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
