'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn, safeParseNumber } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import { ExcludeZonesEditor } from '../ExcludeZonesEditor';
import type { BinSpec, ContainerType, AABB } from '@cratefit/pack';

// Safe ID pattern - only allow alphanumeric, underscore, and hyphen
const sanitizeId = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 256);
};

const CONTAINER_TYPES: { value: ContainerType; labelKey: string }[] = [
  { value: 'box', labelKey: 'containerTypes.box' },
  { value: 'pallet', labelKey: 'containerTypes.pallet' },
  { value: 'container', labelKey: 'containerTypes.container' },
  { value: 'truck', labelKey: 'containerTypes.truck' },
  { value: 'shelf', labelKey: 'containerTypes.shelf' },
  { value: 'custom', labelKey: 'containerTypes.custom' },
];

const PRESETS: Record<string, { width: number; height: number; depth: number; maxWeight?: number; label: string }> = {
  // Pallets
  EUR1: { width: 800, height: 1800, depth: 1200, maxWeight: 1500, label: 'EUR1 (80×120cm)' },
  US: { width: 1016, height: 1800, depth: 1219, maxWeight: 2000, label: 'US (40×48in)' },
  ASIA: { width: 1100, height: 1800, depth: 1100, maxWeight: 1500, label: 'Asia (110×110cm)' },
  // Containers
  '20ft': { width: 2352, height: 2393, depth: 5898, maxWeight: 21770, label: '20ft Container' },
  '40ft': { width: 2352, height: 2393, depth: 12032, maxWeight: 26680, label: '40ft Container' },
  '40ftHC': { width: 2352, height: 2698, depth: 12032, maxWeight: 26460, label: '40ft High Cube' },
};

interface BinCardProps {
  bin: BinSpec;
  onUpdate: (updates: Partial<BinSpec>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function BinCard({ bin, onUpdate, onRemove, canRemove }: BinCardProps) {
  const t = useTranslations('demo');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvanced = bin.maxWeight || bin.cost || (bin.excludeZones && bin.excludeZones.length > 0);

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      onUpdate({
        width: preset.width,
        height: preset.height,
        depth: preset.depth,
        maxWeight: preset.maxWeight,
      });
    }
  };

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-3 flex items-center justify-between">
        <input
          type="text"
          value={bin.id}
          onChange={(e) => onUpdate({ id: sanitizeId(e.target.value) })}
          className="h-7 w-32 rounded border bg-card px-2 text-sm font-medium"
          placeholder="Bin ID"
          maxLength={256}
          aria-label={`ID for container ${bin.id}`}
        />
        {canRemove && (
          <button
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Container Type */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-muted-foreground">{t('containerType')}</label>
        <select
          value={bin.type}
          onChange={(e) => onUpdate({ type: e.target.value as ContainerType })}
          className="h-8 w-full rounded border bg-card px-2 text-sm"
        >
          {CONTAINER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {t(type.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {/* Preset selector */}
      {(bin.type === 'pallet' || bin.type === 'container') && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">{t('presetSizes')}</label>
          <select
            onChange={(e) => e.target.value && applyPreset(e.target.value)}
            className="h-8 w-full rounded border bg-card px-2 text-sm"
            defaultValue=""
          >
            <option value="">-- {t('selectPreset')} --</option>
            {bin.type === 'pallet' && (
              <>
                <option value="EUR1">{PRESETS['EUR1']?.label}</option>
                <option value="US">{PRESETS['US']?.label}</option>
                <option value="ASIA">{PRESETS['ASIA']?.label}</option>
              </>
            )}
            {bin.type === 'container' && (
              <>
                <option value="20ft">{PRESETS['20ft']?.label}</option>
                <option value="40ft">{PRESETS['40ft']?.label}</option>
                <option value="40ftHC">{PRESETS['40ftHC']?.label}</option>
              </>
            )}
          </select>
        </div>
      )}

      {/* Dimensions */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(['width', 'height', 'depth'] as const).map((dim) => (
          <div key={dim}>
            <label className="mb-1 block text-xs uppercase text-muted-foreground">
              {dim.charAt(0)}
            </label>
            <input
              type="number"
              value={bin[dim]}
              onChange={(e) => onUpdate({ [dim]: safeParseNumber(e.target.value, 1, 1) })}
              className="h-8 w-full rounded border bg-card px-2 text-sm"
              min={1}
            />
          </div>
        ))}
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn(
          'flex w-full items-center justify-center gap-1 rounded py-1 text-xs transition-colors',
          hasAdvanced ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t('advancedOptions')}
        {hasAdvanced && <span className="ml-1 text-primary">*</span>}
      </button>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('maxWeight')}</label>
              <input
                type="number"
                value={bin.maxWeight ?? ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  onUpdate({ maxWeight: e.target.value && !isNaN(num) ? num : undefined });
                }}
                className="h-8 w-full rounded border bg-card px-2 text-sm"
                placeholder="∞"
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('cost')}</label>
              <input
                type="number"
                value={bin.cost ?? ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  onUpdate({ cost: e.target.value && !isNaN(num) ? num : undefined });
                }}
                className="h-8 w-full rounded border bg-card px-2 text-sm"
                placeholder="0"
                min={0}
              />
            </div>
          </div>

          {/* Exclude Zones for irregular containers */}
          <ExcludeZonesEditor
            zones={bin.excludeZones ?? []}
            binWidth={bin.width}
            binHeight={bin.height}
            binDepth={bin.depth}
            onChange={(zones) => onUpdate({ excludeZones: zones.length > 0 ? zones : undefined })}
          />
        </div>
      )}
    </div>
  );
}

export function BinsTab() {
  const t = useTranslations('demo');
  const { bins, addBin, updateBin, removeBin } = useDemoStore();

  const handleAddBin = () => {
    addBin({
      id: `bin-${Date.now()}`,
      type: 'box',
      width: 100,
      height: 100,
      depth: 100,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('containers')} ({bins.length})
        </h3>
        <button
          onClick={handleAddBin}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          {t('add')}
        </button>
      </div>

      <div className="space-y-3">
        {bins.map((bin) => (
          <BinCard
            key={bin.id}
            bin={bin}
            onUpdate={(updates) => updateBin(bin.id, updates)}
            onRemove={() => removeBin(bin.id)}
            canRemove={bins.length > 1}
          />
        ))}
      </div>
    </div>
  );
}
