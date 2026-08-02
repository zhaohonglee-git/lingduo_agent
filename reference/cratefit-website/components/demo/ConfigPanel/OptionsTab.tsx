'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { cn, safeParseNumber } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import type { PackOptions } from '@cratefit/pack';

type AlgorithmType = NonNullable<PackOptions['algorithm']>;
type BinSelectionType = NonNullable<PackOptions['binSelection']>;
type PreprocessorType = NonNullable<PackOptions['preprocessor']>;
type EnhancerType = NonNullable<PackOptions['enhancer']>;

const ALGORITHMS: { value: AlgorithmType; labelKey: string; descKey: string }[] = [
  { value: 'extreme-point', labelKey: 'algorithms.extremePoint.name', descKey: 'algorithms.extremePoint.description' },
  { value: 'layer-building', labelKey: 'algorithms.layerBuilding.name', descKey: 'algorithms.layerBuilding.description' },
  { value: 'wall-building', labelKey: 'algorithms.wallBuilding.name', descKey: 'algorithms.wallBuilding.description' },
  { value: 'eb-afit', labelKey: 'algorithms.ebAfit.name', descKey: 'algorithms.ebAfit.description' },
];

const BIN_SELECTIONS: { value: BinSelectionType; labelKey: string }[] = [
  { value: 'first-fit', labelKey: 'binSelections.firstFit' },
  { value: 'best-fit', labelKey: 'binSelections.bestFit' },
  { value: 'spread', labelKey: 'binSelections.spread' },
];

const PREPROCESSORS: { value: PreprocessorType; labelKey: string }[] = [
  { value: 'none', labelKey: 'preprocessors.none' },
  { value: 'block-building', labelKey: 'preprocessors.blockBuilding' },
];

const ENHANCERS: { value: EnhancerType; labelKey: string }[] = [
  { value: 'none', labelKey: 'enhancers.none' },
  { value: 'genetic', labelKey: 'enhancers.genetic' },
];

export function OptionsTab() {
  const t = useTranslations('demo');
  const { options, updateOptions } = useDemoStore();
  const [showAlgoInfo, setShowAlgoInfo] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);

  const selectedAlgo = ALGORITHMS.find((a) => a.value === options.algorithm);

  return (
    <div className="space-y-6">
      {/* Algorithm Selection */}
      <div className="space-y-3">
        <h3 className="border-b pb-2 text-sm font-medium">{t('algorithm')}</h3>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('strategy')}</label>
          <select
            value={options.algorithm ?? 'extreme-point'}
            onChange={(e) => updateOptions({ algorithm: e.target.value as AlgorithmType })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {ALGORITHMS.map((alg) => (
              <option key={alg.value} value={alg.value}>
                {t(alg.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Algorithm Info */}
        <button
          onClick={() => setShowAlgoInfo(!showAlgoInfo)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3 w-3" />
          {showAlgoInfo ? t('hideDetails') : t('showDetails')}
        </button>

        {showAlgoInfo && selectedAlgo && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <strong>{t(selectedAlgo.labelKey)}:</strong> {t(selectedAlgo.descKey)}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('binSelection')}</label>
          <select
            value={options.binSelection ?? 'first-fit'}
            onChange={(e) => updateOptions({ binSelection: e.target.value as BinSelectionType })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {BIN_SELECTIONS.map((sel) => (
              <option key={sel.value} value={sel.value}>
                {t(sel.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('preprocessor')}</label>
            <select
              value={options.preprocessor ?? 'none'}
              onChange={(e) => updateOptions({ preprocessor: e.target.value as PreprocessorType })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {PREPROCESSORS.map((pre) => (
                <option key={pre.value} value={pre.value}>
                  {t(pre.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('enhancer')}</label>
            <select
              value={options.enhancer ?? 'none'}
              onChange={(e) => updateOptions({ enhancer: e.target.value as EnhancerType })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {ENHANCERS.map((enh) => (
                <option key={enh.value} value={enh.value}>
                  {t(enh.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="border-b pb-2 text-sm font-medium">{t('features')}</h3>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.features?.supportCheck ?? false}
              onChange={(e) =>
                updateOptions({
                  features: { ...options.features, supportCheck: e.target.checked },
                })
              }
              className="rounded border-muted-foreground"
            />
            {t('supportCheck')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.features?.weightBalance ?? false}
              onChange={(e) =>
                updateOptions({
                  features: { ...options.features, weightBalance: e.target.checked },
                })
              }
              className="rounded border-muted-foreground"
            />
            {t('weightBalance')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.features?.stackingLimit ?? false}
              onChange={(e) =>
                updateOptions({
                  features: { ...options.features, stackingLimit: e.target.checked },
                })
              }
              className="rounded border-muted-foreground"
            />
            {t('stackingLimit')}
          </label>
        </div>
      </div>

      {/* Constraints */}
      <div className="space-y-3">
        <button
          onClick={() => setShowConstraints(!showConstraints)}
          className="flex w-full items-center gap-1 border-b pb-2 text-sm font-medium"
        >
          {showConstraints ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {t('constraints')}
        </button>

        {showConstraints && (
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.constraints?.respectDeliveryOrder ?? false}
                onChange={(e) =>
                  updateOptions({
                    constraints: { ...options.constraints, respectDeliveryOrder: e.target.checked },
                  })
                }
                className="rounded border-muted-foreground"
              />
              {t('respectDeliveryOrder')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.constraints?.keepGroupsTogether ?? false}
                onChange={(e) =>
                  updateOptions({
                    constraints: { ...options.constraints, keepGroupsTogether: e.target.checked },
                  })
                }
                className="rounded border-muted-foreground"
              />
              {t('keepGroupsTogether')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.constraints?.enforceIncompatibility ?? false}
                onChange={(e) =>
                  updateOptions({
                    constraints: { ...options.constraints, enforceIncompatibility: e.target.checked },
                  })
                }
                className="rounded border-muted-foreground"
              />
              {t('enforceIncompatibility')}
            </label>
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="space-y-3">
        <h3 className="border-b pb-2 text-sm font-medium">{t('performance')}</h3>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t('timeBudget')}</label>
          <input
            type="number"
            value={options.timeBudgetMs ?? 5000}
            onChange={(e) => updateOptions({ timeBudgetMs: safeParseNumber(e.target.value, 5000, 100) })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            min={100}
            max={60000}
            step={100}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">{t('timeBudgetHint')}</p>
        </div>
      </div>
    </div>
  );
}
