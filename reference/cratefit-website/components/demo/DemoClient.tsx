'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDemoStore } from '@/lib/stores/demo-store';
import { getConfigFromUrl } from '@/lib/url-state';
import { ChatSidebar } from './ChatSidebar';
import { Viewer3D } from './Viewer3D';
import { ViewerControls } from './ViewerControls';
import { StatsPanel } from './StatsPanel';

export function DemoClient() {
  const t = useTranslations('demo');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { result, mode, onlinePlacedItems, runPack, autoPack, loadConfig, currentBinIndex, setCurrentBinIndex } = useDemoStore();
  const firstBin = useDemoStore((s) => s.bins[0]);
  const initialPackDone = useRef(false);
  const urlConfigLoaded = useRef(false);
  const hasUrlConfig = useRef(false);

  // Load config from URL on mount
  useEffect(() => {
    if (urlConfigLoaded.current) return;
    urlConfigLoaded.current = true;

    const urlConfig = getConfigFromUrl();
    if (urlConfig) {
      hasUrlConfig.current = true;
      loadConfig(urlConfig);
    }
  }, [loadConfig]);

  // Auto-pack on first load
  useEffect(() => {
    if (!initialPackDone.current && autoPack) {
      initialPackDone.current = true;
      runPack();
    }
  }, [runPack, autoPack]);

  const packedBins = result?.packed ?? [];
  const packedBin = packedBins[currentBinIndex] ?? packedBins[0];
  const stats = result?.stats;

  // For online mode, create a virtual packed bin from placed items
  const onlinePackedBin = (() => {
    if (mode !== 'online' || onlinePlacedItems.length === 0 || !firstBin) return null;

    const totalWeight = onlinePlacedItems.reduce((sum, item) => sum + (item.item.weight || 0), 0);
    const binVolume = firstBin.width * firstBin.height * firstBin.depth;
    const usedVolume = onlinePlacedItems.reduce((sum, item) => {
      const { width, height, depth } = item.item;
      return sum + width * height * depth;
    }, 0);
    const utilization = binVolume > 0 ? usedVolume / binVolume : 0;

    let cogX = 0, cogY = 0, cogZ = 0, totalMass = 0;
    for (const placed of onlinePlacedItems) {
      const mass = placed.item.weight || 1;
      const { x, y, z } = placed.position;
      const { width, height, depth } = placed.item;
      cogX += (x + width / 2) * mass;
      cogY += (y + height / 2) * mass;
      cogZ += (z + depth / 2) * mass;
      totalMass += mass;
    }
    const centerOfGravity = totalMass > 0
      ? { x: cogX / totalMass, y: cogY / totalMass, z: cogZ / totalMass }
      : { x: 0, y: 0, z: 0 };

    return { bin: firstBin, items: onlinePlacedItems, utilization, weight: totalWeight, centerOfGravity };
  })();

  const displayBin = mode === 'online' ? onlinePackedBin : packedBin;

  return (
    <div className="flex h-full">
      {/* === Left Sidebar: Chat (可折叠) === */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-[380px]'} flex-shrink-0 h-full transition-all duration-200`}>
        <ChatSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* === Right: 3D Viewer + Stats === */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 3D Viewer */}
        <div className="relative min-h-0 flex-1 bg-muted/30">
          {displayBin ? (
            <>
              <Viewer3D packedBin={displayBin} />
              <ViewerControls packedBin={displayBin} />

              {/* Bin Selector (for multi-bin results) */}
              {packedBins.length > 1 && mode === 'offline' && (
                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-background/90 px-2 py-1.5 shadow-sm backdrop-blur-sm">
                  <button
                    onClick={() => setCurrentBinIndex(Math.max(0, currentBinIndex - 1))}
                    disabled={currentBinIndex === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[80px] text-center text-sm">
                    {t('container')} {currentBinIndex + 1} / {packedBins.length}
                  </span>
                  <button
                    onClick={() => setCurrentBinIndex(Math.min(packedBins.length - 1, currentBinIndex + 1))}
                    disabled={currentBinIndex === packedBins.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-4xl mb-3">📐</p>
                <p className="text-sm">在左侧 Agent 对话中输入码垛需求</p>
                <p className="text-xs mt-1 text-muted-foreground/60">
                  拖拽旋转 · 滚轮缩放 · 右键平移
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        {result && mode === 'offline' && (
          <StatsPanel result={result} currentBin={packedBin} />
        )}
      </div>
    </div>
  );
}
