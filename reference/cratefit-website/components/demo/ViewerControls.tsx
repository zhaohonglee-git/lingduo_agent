'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Grid3X3,
  Box,
  Target,
  Expand,
  RotateCw,
  Orbit,
  Layers,
  Eye,
  EyeOff,
  FileText,
  Camera,
  Check,
  CircleDot,
} from 'lucide-react';
import { cn, safeParseNumber } from '@/lib/utils';
import { useDemoStore } from '@/lib/stores/demo-store';
import { PackingInstructions } from './PackingInstructions';
import type { PackedBin } from '@cratefit/pack';

interface ViewerControlsProps {
  packedBin?: PackedBin | null;
}

export function ViewerControls({ packedBin }: ViewerControlsProps) {
  const t = useTranslations('demo');
  const { viewerSettings, setViewerSettings } = useDemoStore();
  const [showInstructions, setShowInstructions] = useState(false);
  const [screenshotTaken, setScreenshotTaken] = useState(false);
  const [screenshotDownloaded, setScreenshotDownloaded] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const screenshotTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (screenshotTimeoutRef.current) {
        clearTimeout(screenshotTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const takeScreenshot = useCallback(async () => {
    // Find the Three.js canvas in the DOM
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      setScreenshotError('No canvas found');
      return;
    }

    // Clear all previous states and pending timeouts
    setScreenshotError(null);
    setScreenshotTaken(false);
    setScreenshotDownloaded(false);
    if (screenshotTimeoutRef.current) clearTimeout(screenshotTimeoutRef.current);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);

    try {
      // Check canvas size to prevent oversized data URLs
      // Account for PNG + base64 encoding overhead (multiply by 1.5 for safety)
      const estimatedSize = canvas.width * canvas.height * 4 * 1.5;
      if (estimatedSize > 10 * 1024 * 1024) {
        throw new Error('Canvas too large for screenshot');
      }

      // Get image data from canvas (can throw SecurityError if tainted)
      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'SecurityError') {
          throw new Error('Canvas tainted by cross-origin data');
        }
        throw err;
      }

      // Verify actual data URL size
      if (dataUrl.length > 10 * 1024 * 1024) {
        throw new Error('Screenshot size exceeds limit');
      }

      // Try to copy to clipboard first
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setScreenshotTaken(true);
        setScreenshotDownloaded(false);
        if (screenshotTimeoutRef.current) clearTimeout(screenshotTimeoutRef.current);
        screenshotTimeoutRef.current = setTimeout(() => setScreenshotTaken(false), 2000);
      } catch {
        // Fallback: download the image (clipboard not available)
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `cratefit-screenshot-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setScreenshotDownloaded(true);
        setScreenshotTaken(false);
        if (screenshotTimeoutRef.current) clearTimeout(screenshotTimeoutRef.current);
        screenshotTimeoutRef.current = setTimeout(() => setScreenshotDownloaded(false), 2000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Screenshot failed';
      console.error('Screenshot failed:', error);
      setScreenshotError(message);
      // Clear error after 3 seconds
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setScreenshotError(null), 3000);
    }
  }, []);

  const handleResetView = useCallback(() => {
    // Find the Three.js canvas and trigger a reset by dispatching a custom event
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.dispatchEvent(new CustomEvent('resetView'));
    }
  }, []);

  const toggleButtons = [
    {
      key: 'showEdges',
      icon: Box,
      label: t('viewer.edges'),
      value: viewerSettings.showEdges,
    },
    {
      key: 'showGrid',
      icon: Grid3X3,
      label: t('viewer.grid'),
      value: viewerSettings.showGrid,
    },
    {
      key: 'showCenterOfGravity',
      icon: Target,
      label: t('viewer.cog'),
      value: viewerSettings.showCenterOfGravity,
    },
    {
      key: 'explodedView',
      icon: Expand,
      label: t('viewer.explode'),
      value: viewerSettings.explodedView,
    },
    {
      key: 'autoRotate',
      icon: Orbit,
      label: t('viewer.autoRotate'),
      value: viewerSettings.autoRotate,
    },
  ] as const;

  return (
    <>
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 rounded-lg border bg-background/90 p-2 shadow-sm backdrop-blur-sm">
        {/* Action Buttons */}
        {packedBin && (
          <div className="flex gap-1">
            <button
              onClick={() => setShowInstructions(true)}
              className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm hover:bg-muted"
              title={t('instructions.title')}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('instructions.title')}</span>
            </button>
            <button
              onClick={takeScreenshot}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                screenshotTaken || screenshotDownloaded
                  ? 'bg-green-500/10 text-green-600'
                  : screenshotError
                    ? 'bg-red-500/10 text-red-600'
                    : 'bg-background hover:bg-muted'
              )}
              title={
                screenshotTaken
                  ? t('viewer.screenshotCopied')
                  : screenshotDownloaded
                    ? t('viewer.screenshotDownloaded')
                    : screenshotError ?? t('viewer.screenshot')
              }
            >
              {screenshotTaken || screenshotDownloaded ? (
                <Check className="h-4 w-4" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {/* Toggle Buttons */}
        <div className="flex gap-1">
          {toggleButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() =>
                setViewerSettings({ [btn.key]: !btn.value })
              }
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                btn.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
              title={btn.label}
            >
              <btn.icon className="h-4 w-4" />
            </button>
          ))}
          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
            title={t('viewer.resetView')}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

      {/* Explode Distance Slider (only show when exploded view is on) */}
      {viewerSettings.explodedView && (
        <div className="px-1">
          <label className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Expand className="h-3 w-3" />
            {t('viewer.explodeDistance')}
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={viewerSettings.explodeDistance}
            onChange={(e) =>
              setViewerSettings({ explodeDistance: safeParseNumber(e.target.value, 1, 1) })
            }
            className="h-1 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
          />
        </div>
      )}

      {/* Layer Filter */}
      <div className="border-t pt-2">
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Layers className="h-3 w-3" />
            {t('viewer.layers')}
          </label>
          <button
            onClick={() =>
              setViewerSettings({
                layerFilter: viewerSettings.layerFilter === null ? 1 : null,
              })
            }
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded transition-colors',
              viewerSettings.layerFilter !== null
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={
              viewerSettings.layerFilter !== null
                ? t('viewer.showAll')
                : t('viewer.filterLayers')
            }
          >
            {viewerSettings.layerFilter !== null ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </button>
        </div>
        {viewerSettings.layerFilter !== null && (
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={viewerSettings.layerFilter}
            onChange={(e) =>
              setViewerSettings({ layerFilter: safeParseNumber(e.target.value, 1, 1) })
            }
            className="mt-1 h-1 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
          />
        )}
      </div>

      {/* Item Opacity Slider */}
      <div className="border-t pt-2 px-1">
        <label className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CircleDot className="h-3 w-3" />
          {t('viewer.opacity')}
        </label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={viewerSettings.itemOpacity}
          onChange={(e) =>
            setViewerSettings({ itemOpacity: safeParseNumber(e.target.value, 1, 0.1) })
          }
          className="h-1 w-full cursor-pointer appearance-none rounded bg-muted accent-primary"
        />
      </div>
      </div>

      {/* Packing Instructions Modal */}
      {showInstructions && packedBin && (
        <PackingInstructions
          packedBin={packedBin}
          onClose={() => setShowInstructions(false)}
        />
      )}
    </>
  );
}
