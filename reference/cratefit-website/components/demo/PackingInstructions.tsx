'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Copy, Download, Check, FileText, Code, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PackedBin } from '@cratefit/pack';
import {
  generateInstructions,
  formatAsMarkdown,
  formatAsJson,
  type InstructionsExportOptions,
} from '@/lib/instructions';

type ViewMode = 'preview' | 'markdown' | 'json';

interface PackingInstructionsProps {
  packedBin: PackedBin;
  onClose: () => void;
}

export function PackingInstructions({ packedBin, onClose }: PackingInstructionsProps) {
  const t = useTranslations('demo');
  const locale = useLocale() as 'en' | 'zh-TW';

  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includePositions, setIncludePositions] = useState(true);
  const [groupByLayer, setGroupByLayer] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const instructions = useMemo(() => generateInstructions(packedBin), [packedBin]);

  const exportOptions: InstructionsExportOptions = {
    language: locale,
    includeNotes,
    includePositions,
    groupByLayer,
  };

  const formattedContent = useMemo(() => {
    if (viewMode === 'json') {
      return formatAsJson(instructions, exportOptions);
    }
    return formatAsMarkdown(instructions, exportOptions);
  }, [instructions, exportOptions, viewMode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedContent);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = viewMode === 'json' ? 'json' : 'md';
    const mimeType = viewMode === 'json' ? 'application/json' : 'text/markdown';
    const blob = new Blob([formattedContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packing-instructions-${packedBin.bin.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const viewModeButtons = [
    { id: 'preview' as const, icon: Eye, label: t('instructions.preview') },
    { id: 'markdown' as const, icon: FileText, label: 'Markdown' },
    { id: 'json' as const, icon: Code, label: 'JSON' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{t('instructions.title')}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4 border-b px-6 py-3">
          {/* View Mode */}
          <div className="flex rounded-md border">
            {viewModeButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setViewMode(btn.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  viewMode === btn.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <btn.icon className="h-3.5 w-3.5" />
                {btn.label}
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={groupByLayer}
                onChange={(e) => setGroupByLayer(e.target.checked)}
                className="rounded border"
              />
              {t('instructions.groupByLayer')}
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={includePositions}
                onChange={(e) => setIncludePositions(e.target.checked)}
                className="rounded border"
              />
              {t('instructions.includePositions')}
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="rounded border"
              />
              {t('instructions.includeNotes')}
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'preview' ? (
            <PreviewContent instructions={instructions} exportOptions={exportOptions} />
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
              {formattedContent}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors',
              copied
                ? 'bg-green-500/10 text-green-600'
                : 'border hover:bg-muted'
            )}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                {t('utility.copied')}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t('instructions.copy')}
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            {t('instructions.download')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Preview component
function PreviewContent({
  instructions,
  exportOptions,
}: {
  instructions: ReturnType<typeof generateInstructions>;
  exportOptions: InstructionsExportOptions;
}) {
  const t = useTranslations('demo');

  // Group steps by layer if option enabled
  const stepsByLayer = useMemo(() => {
    if (!exportOptions.groupByLayer) return null;

    const map = new Map<number, typeof instructions.steps>();
    for (const step of instructions.steps) {
      const steps = map.get(step.layer) ?? [];
      steps.push(step);
      map.set(step.layer, steps);
    }
    return map;
  }, [instructions.steps, exportOptions.groupByLayer]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-medium">{t('instructions.summary')}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">{t('instructions.dimensions')}</div>
            <div className="font-medium">
              {instructions.binDimensions.width} × {instructions.binDimensions.height} ×{' '}
              {instructions.binDimensions.depth}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('instructions.items')}</div>
            <div className="font-medium">{instructions.totalItems}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('instructions.layers')}</div>
            <div className="font-medium">{instructions.totalLayers}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('utilization')}</div>
            <div className="font-medium">
              {(instructions.utilization * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      {stepsByLayer ? (
        // Grouped by layer
        Array.from(stepsByLayer.entries()).map(([layer, steps]) => (
          <div key={layer}>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
              {t('instructions.layer')} {layer}
            </h4>
            <div className="space-y-2">
              {steps.map((step) => (
                <StepCard key={step.stepNumber} step={step} options={exportOptions} />
              ))}
            </div>
          </div>
        ))
      ) : (
        // Sequential
        <div className="space-y-2">
          {instructions.steps.map((step) => (
            <StepCard key={step.stepNumber} step={step} options={exportOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  options,
}: {
  step: ReturnType<typeof generateInstructions>['steps'][number];
  options: InstructionsExportOptions;
}) {
  const t = useTranslations('demo');

  const actionLabel = {
    place: t('instructions.actions.place'),
    stack: t('instructions.actions.stack'),
    rotate: t('instructions.actions.rotate'),
  }[step.action];

  const orientationLabel = {
    upright: t('instructions.orientations.upright'),
    flat: t('instructions.orientations.flat'),
    sideways: t('instructions.orientations.sideways'),
  }[step.orientation];

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {step.stepNumber}
            </span>
            <span className="font-medium">{actionLabel}</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              {step.item.item.id}
            </code>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {step.item.item.width} × {step.item.item.height} × {step.item.item.depth}
            {options.includePositions && (
              <span className="ml-2">
                @ ({step.position.x}, {step.position.y}, {step.position.z})
              </span>
            )}
            <span className="ml-2">• {orientationLabel}</span>
          </div>
        </div>
      </div>
      {options.includeNotes && step.notes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {step.notes.map((note, i) => (
            <span
              key={i}
              className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-400"
            >
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
