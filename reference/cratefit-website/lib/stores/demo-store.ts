import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  pack,
  OnlinePacker,
  type BinSpec,
  type ItemSpec,
  type PackOptions,
  type PackResult,
  type PlacementResult,
  type PlacedItem,
  type OnlinePackerStats,
} from '@cratefit/pack';

// Extended item with quantity and color for demo UI
export interface DemoItem extends Omit<ItemSpec, 'id'> {
  id: string;
  quantity: number;
  color: string;
}

// Online placement history entry
export interface OnlinePlacementEntry {
  item: ItemSpec;
  result: PlacementResult;
  timestamp: number;
}

// Viewer settings
export interface ViewerSettings {
  showEdges: boolean;
  showGrid: boolean;
  showCenterOfGravity: boolean;
  explodedView: boolean;
  explodeDistance: number;
  layerFilter: number | null;
  autoRotate: boolean;
  itemOpacity: number;
}

// Highlight state for hover sync
export interface HighlightState {
  itemId: string | null;
  binId: string | null;
  source: 'viewer' | 'panel' | null;
}

// Demo state interface
interface DemoState {
  // Configuration
  bins: BinSpec[];
  items: DemoItem[];
  options: PackOptions;

  // Selected example
  selectedExampleId: string | null;

  // Current bin index (for multi-bin results)
  currentBinIndex: number;

  // Mode
  mode: 'offline' | 'online';

  // Packing result
  result: PackResult | null;
  isPacking: boolean;

  // Online packing state
  onlinePacker: OnlinePacker | null;
  onlineStats: OnlinePackerStats | null;
  onlineHistory: OnlinePlacementEntry[];
  onlinePlacedItems: PlacedItem[];

  // Viewer settings
  viewerSettings: ViewerSettings;

  // Highlight state
  highlight: HighlightState;

  // Auto-pack
  autoPack: boolean;

  // Actions - Bins
  setBins: (bins: BinSpec[]) => void;
  addBin: (bin: BinSpec) => void;
  updateBin: (id: string, updates: Partial<BinSpec>) => void;
  removeBin: (id: string) => void;

  // Actions - Items
  setItems: (items: DemoItem[]) => void;
  addItem: (item: DemoItem) => void;
  updateItem: (id: string, updates: Partial<DemoItem>) => void;
  removeItem: (id: string) => void;

  // Actions - Options
  setOptions: (options: PackOptions) => void;
  updateOptions: (updates: Partial<PackOptions>) => void;

  // Actions - Mode
  setMode: (mode: 'offline' | 'online') => void;

  // Actions - Packing
  runPack: () => void;
  setResult: (result: PackResult | null) => void;

  // Actions - Online Packing
  initOnlinePacker: () => void;
  placeOnlineItem: (item: ItemSpec) => PlacementResult;
  resetOnlinePacker: () => void;

  // Actions - Viewer
  setViewerSettings: (settings: Partial<ViewerSettings>) => void;

  // Actions - Highlight
  setHighlight: (highlight: Partial<HighlightState>) => void;
  clearHighlight: () => void;

  // Actions - Auto-pack
  setAutoPack: (autoPack: boolean) => void;

  // Actions - Example selection
  setSelectedExampleId: (id: string | null) => void;

  // Actions - Bin navigation
  setCurrentBinIndex: (index: number) => void;

  // Actions - Utility
  reset: () => void;
  loadConfig: (config: { bins: BinSpec[]; items: DemoItem[]; options: PackOptions }, exampleId?: string) => void;
  exportConfig: () => { bins: BinSpec[]; items: DemoItem[]; options: PackOptions };
}

// Default bin
const DEFAULT_BIN: BinSpec = {
  id: 'bin-1',
  type: 'box',
  width: 100,
  height: 100,
  depth: 100,
};

// Default items
const DEFAULT_ITEMS: DemoItem[] = [
  { id: 'item-1', width: 40, height: 30, depth: 50, quantity: 2, color: '#3b82f6' },
  { id: 'item-2', width: 30, height: 40, depth: 30, quantity: 3, color: '#10b981' },
  { id: 'item-3', width: 20, height: 20, depth: 20, quantity: 5, color: '#f59e0b' },
];

// Default options
const DEFAULT_OPTIONS: PackOptions = {
  algorithm: 'extreme-point',
};

// Default viewer settings
const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  showEdges: true,
  showGrid: true,
  showCenterOfGravity: false,
  explodedView: false,
  explodeDistance: 1.5,
  layerFilter: null,
  autoRotate: false,
  itemOpacity: 0.9,
};

// Helper to expand items with quantity
const expandItems = (items: DemoItem[]): ItemSpec[] => {
  const expanded: ItemSpec[] = [];
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

// Debounced auto-pack with isolated timeout to prevent race conditions
// Using a closure to ensure timeout is scoped to this module instance
// The callback receives a getter function to always access the latest state
const createAutoPackScheduler = () => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (getRunPack: () => (() => void)) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // Get the latest runPack function when the timeout fires
      // This ensures we use the most current state instead of a stale closure
      const runPack = getRunPack();
      runPack();
    }, 300);
  };
};
const scheduleAutoPack = createAutoPackScheduler();

// Helper to check if auto-pack should be scheduled
// Only schedule if autoPack is enabled, mode is offline, and there's data to pack
const shouldScheduleAutoPack = (state: { autoPack: boolean; mode: string; bins: BinSpec[]; items: DemoItem[] }) => {
  return state.autoPack && state.mode === 'offline' && state.bins.length > 0 && state.items.length > 0;
};

export const useDemoStore = create<DemoState>()((set, get) => ({
  // Initial state
  bins: [DEFAULT_BIN],
  items: DEFAULT_ITEMS,
  options: DEFAULT_OPTIONS,
  selectedExampleId: null,
  currentBinIndex: 0,
  mode: 'offline',
  result: null,
  isPacking: false,
  onlinePacker: null,
  onlineStats: null,
  onlineHistory: [],
  onlinePlacedItems: [],
  viewerSettings: DEFAULT_VIEWER_SETTINGS,
  highlight: { itemId: null, binId: null, source: null },
  autoPack: true,

  // Bins actions
  setBins: (bins) => {
    set({ bins });
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  addBin: (bin) => {
    set((state) => ({ bins: [...state.bins, bin] }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  updateBin: (id, updates) => {
    set((state) => ({
      bins: state.bins.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  removeBin: (id) => {
    set((state) => ({ bins: state.bins.filter((b) => b.id !== id) }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },

  // Items actions
  setItems: (items) => {
    set({ items });
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  addItem: (item) => {
    set((state) => ({ items: [...state.items, item] }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },

  // Options actions
  setOptions: (options) => {
    set({ options });
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  updateOptions: (updates) => {
    set((state) => ({ options: { ...state.options, ...updates } }));
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },

  // Mode actions
  setMode: (mode) => {
    set({ mode });
    if (mode === 'online') {
      get().initOnlinePacker();
    }
  },

  // Packing actions
  runPack: () => {
    const { bins, items, options, isPacking, mode } = get();
    if (bins.length === 0 || items.length === 0 || isPacking || mode !== 'offline') return;

    set({ isPacking: true });

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const expandedItems = expandItems(items);
        const result = pack({
          bins,
          items: expandedItems,
          options,
        });
        set({ result, isPacking: false });
      } catch (error) {
        console.error('Packing failed:', error);
        set({ isPacking: false });
      }
    }, 50);
  },
  setResult: (result) => set({ result }),

  // Online packing actions
  initOnlinePacker: () => {
    const { bins, options } = get();
    if (bins.length === 0) {
      // Ensure consistent state - can't be in online mode without bins
      set({ mode: 'offline' });
      return;
    }

    // Map spread to first-fit for online packer (spread not supported in online mode)
    const binSelection = options.binSelection === 'spread' ? 'first-fit' : (options.binSelection || 'first-fit');
    const packer = new OnlinePacker({
      bins,
      algorithm: 'online-extreme-point',
      binSelection: binSelection as 'first-fit' | 'best-fit' | 'worst-fit',
      features: options.features,
    });

    set({
      onlinePacker: packer,
      onlineStats: packer.getStats(),
      onlineHistory: [],
      onlinePlacedItems: [],
      result: null,
    });
  },
  placeOnlineItem: (item) => {
    const { onlinePacker } = get();
    if (!onlinePacker) {
      return { success: false, reason: 'no-bins' as const };
    }

    const result = onlinePacker.placeItem(item);

    // Get all placed items from all bins
    const allPlacedItems: PlacedItem[] = [];
    for (const binState of onlinePacker.getAllBinStates()) {
      allPlacedItems.push(...binState.items);
    }

    set((state) => ({
      onlineStats: onlinePacker.getStats(),
      onlineHistory: [
        ...state.onlineHistory,
        { item, result, timestamp: Date.now() },
      ],
      onlinePlacedItems: allPlacedItems,
    }));

    return result;
  },
  resetOnlinePacker: () => {
    const { onlinePacker, bins } = get();
    if (onlinePacker) {
      // If no bins available, exit online mode to prevent invalid state
      if (bins.length === 0) {
        set({
          mode: 'offline',
          onlinePacker: null,
          onlineStats: null,
          onlineHistory: [],
          onlinePlacedItems: [],
        });
        return;
      }
      try {
        onlinePacker.reset();
        for (const bin of bins) {
          onlinePacker.addBin(bin);
        }
      } catch (error) {
        console.error('Online packer reset failed:', error);
        // Force exit to offline mode on error
        set({
          mode: 'offline',
          onlinePacker: null,
          onlineStats: null,
          onlineHistory: [],
          onlinePlacedItems: [],
        });
        return;
      }
    }
    set({
      onlineStats: onlinePacker?.getStats() ?? null,
      onlineHistory: [],
      onlinePlacedItems: [],
    });
  },

  // Viewer actions
  setViewerSettings: (settings) => {
    set((state) => ({
      viewerSettings: { ...state.viewerSettings, ...settings },
    }));
  },

  // Highlight actions
  setHighlight: (highlight) => {
    set((state) => ({
      highlight: { ...state.highlight, ...highlight },
    }));
  },
  clearHighlight: () => {
    set({ highlight: { itemId: null, binId: null, source: null } });
  },

  // Auto-pack actions
  setAutoPack: (autoPack) => {
    set({ autoPack });
    if (autoPack && get().mode === 'offline') {
      get().runPack();
    }
  },

  // Example selection
  setSelectedExampleId: (id) => set({ selectedExampleId: id }),

  // Bin navigation
  setCurrentBinIndex: (index) => set({ currentBinIndex: index }),

  // Utility actions
  reset: () => {
    set({
      bins: [DEFAULT_BIN],
      items: DEFAULT_ITEMS,
      options: DEFAULT_OPTIONS,
      selectedExampleId: null,
      currentBinIndex: 0,
      mode: 'offline',
      result: null,
      isPacking: false,
      onlinePacker: null,
      onlineStats: null,
      onlineHistory: [],
      onlinePlacedItems: [],
      viewerSettings: DEFAULT_VIEWER_SETTINGS,
      highlight: { itemId: null, binId: null, source: null },
    });
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  loadConfig: (config, exampleId) => {
    set({
      bins: config.bins,
      items: config.items,
      options: config.options,
      selectedExampleId: exampleId ?? null,
      currentBinIndex: 0,
      result: null,
    });
    if (shouldScheduleAutoPack(get())) scheduleAutoPack(() => get().runPack);
  },
  exportConfig: () => {
    const { bins, items, options } = get();
    return { bins, items, options };
  },
}));
