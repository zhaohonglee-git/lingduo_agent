import type { BinSpec, PackOptions } from '@cratefit/pack';
import type { DemoItem } from './stores/demo-store';
import {
  Zap,
  Package,
  Box,
  Layers,
  Truck,
  Scale,
  RotateCcw,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Color palette for items
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
] as const;

// Helper to get color safely
const getColor = (index: number): string => {
  const color = COLORS[index % COLORS.length];
  return color ?? '#3b82f6';
};

// Example categories
export type ExampleCategory = 'quickStart' | 'basicPacking' | 'constraints' | 'realScenarios';

export interface DemoExample {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: ExampleCategory;
  icon: LucideIcon;
  bins: BinSpec[];
  items: DemoItem[];
  options: PackOptions;
}

export const EXAMPLE_CATEGORIES: { id: ExampleCategory; nameKey: string }[] = [
  { id: 'quickStart', nameKey: 'examples.categories.quickStart' },
  { id: 'basicPacking', nameKey: 'examples.categories.basicPacking' },
  { id: 'constraints', nameKey: 'examples.categories.constraints' },
  { id: 'realScenarios', nameKey: 'examples.categories.realScenarios' },
];

export const DEMO_EXAMPLES: DemoExample[] = [
  // ============================================
  // QUICK START
  // ============================================
  {
    id: 'quick-start',
    nameKey: 'examples.quickStart.name',
    descriptionKey: 'examples.quickStart.description',
    category: 'quickStart',
    icon: Zap,
    bins: [
      { id: 'box-1', type: 'box', width: 100, height: 100, depth: 100, maxWeight: 100 },
    ],
    items: [
      { id: 'item-a', width: 50, height: 25, depth: 40, weight: 5, quantity: 3, color: getColor(0) },
      { id: 'item-b', width: 40, height: 20, depth: 35, weight: 3, quantity: 3, color: getColor(1) },
      { id: 'item-c', width: 30, height: 20, depth: 30, weight: 2, quantity: 4, color: getColor(2) },
      { id: 'item-d', width: 25, height: 15, depth: 25, weight: 1, quantity: 4, color: getColor(3) },
    ],
    options: {
      algorithm: 'extreme-point',
    },
  },

  // ============================================
  // BASIC PACKING
  // ============================================
  {
    id: 'basic-cubes',
    nameKey: 'examples.basicCubes.name',
    descriptionKey: 'examples.basicCubes.description',
    category: 'basicPacking',
    icon: Package,
    bins: [
      { id: 'box-1', type: 'box', width: 100, height: 120, depth: 100, maxWeight: 80 },
    ],
    items: [
      { id: 'cube-a', width: 40, height: 25, depth: 50, weight: 5, quantity: 3, color: getColor(0) },
      { id: 'cube-b', width: 30, height: 30, depth: 30, weight: 3, quantity: 4, color: getColor(1) },
      { id: 'cube-c', width: 20, height: 20, depth: 20, weight: 1, quantity: 6, color: getColor(2) },
    ],
    options: {
      algorithm: 'extreme-point',
    },
  },

  {
    id: 'multi-bin',
    nameKey: 'examples.multiBin.name',
    descriptionKey: 'examples.multiBin.description',
    category: 'basicPacking',
    icon: Box,
    bins: [
      { id: 'small', type: 'box', width: 30, height: 25, depth: 20, cost: 3 },
      { id: 'medium', type: 'box', width: 50, height: 40, depth: 35, cost: 6 },
      { id: 'large', type: 'box', width: 80, height: 60, depth: 50, cost: 10 },
    ],
    items: [
      { id: 'laptop', width: 40, height: 5, depth: 30, quantity: 1, color: getColor(0) },
      { id: 'mouse', width: 12, height: 8, depth: 6, quantity: 1, color: getColor(1) },
      { id: 'keyboard', width: 45, height: 4, depth: 15, quantity: 1, color: getColor(2) },
      { id: 'monitor', width: 60, height: 40, depth: 15, quantity: 1, color: getColor(3) },
      { id: 'headphones', width: 20, height: 18, depth: 10, quantity: 1, color: getColor(4) },
      { id: 'webcam', width: 8, height: 8, depth: 5, quantity: 1, color: getColor(5) },
      { id: 'charger', width: 10, height: 5, depth: 6, quantity: 2, color: getColor(6) },
    ],
    options: {
      algorithm: 'extreme-point',
      binSelection: 'best-fit',
      optimize: {
        target: 'cost',
      },
    },
  },

  {
    id: 'mixed-sizes',
    nameKey: 'examples.mixedSizes.name',
    descriptionKey: 'examples.mixedSizes.description',
    category: 'basicPacking',
    icon: Package,
    bins: [
      { id: 'standard-box', type: 'box', width: 500, height: 400, depth: 500, maxWeight: 100 },
    ],
    items: [
      // Large items
      { id: 'large-1', width: 200, height: 150, depth: 200, weight: 15, quantity: 1, color: getColor(0) },
      { id: 'large-2', width: 180, height: 180, depth: 180, weight: 12, quantity: 1, color: getColor(1) },
      // Medium items
      { id: 'medium-1', width: 120, height: 100, depth: 110, weight: 6, quantity: 1, color: getColor(2) },
      { id: 'medium-2', width: 100, height: 80, depth: 100, weight: 5, quantity: 1, color: getColor(3) },
      { id: 'medium-3', width: 110, height: 90, depth: 90, weight: 4, quantity: 1, color: getColor(4) },
      // Small items
      { id: 'small-1', width: 60, height: 50, depth: 50, weight: 2, quantity: 1, color: getColor(5) },
      { id: 'small-2', width: 50, height: 40, depth: 40, weight: 1, quantity: 2, color: getColor(6) },
      { id: 'small-3', width: 40, height: 30, depth: 35, weight: 1, quantity: 2, color: getColor(7) },
    ],
    options: {
      algorithm: 'extreme-point',
      features: {
        supportCheck: true,
      },
    },
  },

  // ============================================
  // CONSTRAINTS
  // ============================================
  {
    id: 'weight-constraints',
    nameKey: 'examples.weightConstraints.name',
    descriptionKey: 'examples.weightConstraints.description',
    category: 'constraints',
    icon: Scale,
    bins: [
      { id: 'weight-limited', type: 'box', width: 100, height: 100, depth: 100, maxWeight: 50 },
    ],
    items: [
      { id: 'heavy-1', width: 40, height: 40, depth: 40, weight: 20, quantity: 1, color: getColor(0) },
      { id: 'heavy-2', width: 40, height: 40, depth: 40, weight: 20, quantity: 1, color: getColor(1) },
      { id: 'heavy-3', width: 40, height: 40, depth: 40, weight: 20, quantity: 1, color: getColor(2) },
    ],
    options: {
      algorithm: 'extreme-point',
    },
  },

  {
    id: 'fragile-items',
    nameKey: 'examples.fragileItems.name',
    descriptionKey: 'examples.fragileItems.description',
    category: 'constraints',
    icon: Package,
    bins: [
      { id: 'cargo-box', type: 'box', width: 600, height: 500, depth: 600, maxWeight: 200 },
    ],
    items: [
      { id: 'fragile-1', width: 250, height: 150, depth: 250, weight: 8, maxStackWeight: 15, quantity: 2, color: getColor(3) },
      { id: 'light', width: 200, height: 100, depth: 200, weight: 5, quantity: 2, color: getColor(1) },
      { id: 'heavy', width: 200, height: 120, depth: 200, weight: 25, quantity: 2, color: getColor(0) },
    ],
    options: {
      algorithm: 'extreme-point',
      features: {
        supportCheck: true,
        stackingLimit: true,
      },
    },
  },

  {
    id: 'rotation-constraints',
    nameKey: 'examples.rotationConstraints.name',
    descriptionKey: 'examples.rotationConstraints.description',
    category: 'constraints',
    icon: RotateCcw,
    bins: [
      { id: 'bin', type: 'box', width: 200, height: 150, depth: 200, maxWeight: 200 },
    ],
    items: [
      { id: 'all-rotation', width: 60, height: 30, depth: 40, weight: 5, rotationType: 'all', quantity: 1, color: getColor(0) },
      { id: 'horizontal-1', width: 40, height: 80, depth: 30, weight: 8, rotationType: 'horizontal', quantity: 1, color: getColor(1) },
      { id: 'horizontal-2', width: 50, height: 70, depth: 35, weight: 7, rotationType: 'horizontal', quantity: 1, color: getColor(2) },
      { id: 'fixed-1', width: 45, height: 25, depth: 55, weight: 4, rotationType: 'fixed', quantity: 1, color: getColor(3) },
      { id: 'fixed-2', width: 35, height: 35, depth: 35, weight: 3, rotationType: 'fixed', quantity: 1, color: getColor(4) },
    ],
    options: {
      algorithm: 'extreme-point',
    },
  },

  {
    id: 'group-constraints',
    nameKey: 'examples.groupConstraints.name',
    descriptionKey: 'examples.groupConstraints.description',
    category: 'constraints',
    icon: Users,
    bins: [
      { id: 'bin-1', type: 'box', width: 150, height: 100, depth: 150, maxWeight: 100 },
      { id: 'bin-2', type: 'box', width: 150, height: 100, depth: 150, maxWeight: 100 },
    ],
    items: [
      { id: 'food-1', width: 40, height: 30, depth: 40, weight: 5, groupId: 'food', quantity: 1, color: getColor(1) },
      { id: 'food-2', width: 35, height: 35, depth: 35, weight: 4, groupId: 'food', quantity: 1, color: getColor(1) },
      { id: 'food-3', width: 45, height: 25, depth: 40, weight: 6, groupId: 'food', quantity: 1, color: getColor(1) },
      { id: 'chemical-1', width: 30, height: 40, depth: 30, weight: 8, groupId: 'chemical', incompatibleWith: ['food'], quantity: 1, color: getColor(3) },
      { id: 'chemical-2', width: 35, height: 35, depth: 35, weight: 7, groupId: 'chemical', incompatibleWith: ['food'], quantity: 1, color: getColor(3) },
    ],
    options: {
      algorithm: 'extreme-point',
      constraints: {
        enforceIncompatibility: true,
        keepGroupsTogether: true,
      },
    },
  },

  {
    id: 'support-requirements',
    nameKey: 'examples.supportRequirements.name',
    descriptionKey: 'examples.supportRequirements.description',
    category: 'constraints',
    icon: Layers,
    bins: [
      { id: 'bin', type: 'box', width: 200, height: 200, depth: 200, maxWeight: 500 },
    ],
    items: [
      { id: 'heavy-base', width: 80, height: 40, depth: 80, weight: 50, requiresFloor: true, quantity: 2, color: getColor(0) },
      { id: 'needs-support-1', width: 70, height: 40, depth: 70, weight: 15, requiresSupport: 0.8, quantity: 2, color: getColor(1) },
      { id: 'needs-support-2', width: 60, height: 35, depth: 60, weight: 12, requiresSupport: 0.8, quantity: 2, color: getColor(2) },
      { id: 'normal-1', width: 50, height: 30, depth: 50, weight: 5, quantity: 2, color: getColor(3) },
      { id: 'normal-2', width: 40, height: 25, depth: 40, weight: 4, quantity: 2, color: getColor(4) },
      { id: 'normal-3', width: 35, height: 20, depth: 35, weight: 3, quantity: 2, color: getColor(5) },
    ],
    options: {
      algorithm: 'extreme-point',
      features: {
        supportCheck: true,
      },
    },
  },

  // ============================================
  // REAL SCENARIOS
  // ============================================
  {
    id: 'pallet-loading',
    nameKey: 'examples.palletLoading.name',
    descriptionKey: 'examples.palletLoading.description',
    category: 'realScenarios',
    icon: Layers,
    bins: [
      { id: 'EUR1', type: 'pallet', width: 800, height: 1800, depth: 1200, maxWeight: 1000 },
    ],
    items: [
      { id: 'heavy-box', width: 400, height: 300, depth: 600, weight: 25, quantity: 4, color: getColor(0), rotationType: 'horizontal' },
      { id: 'medium-box', width: 300, height: 250, depth: 400, weight: 12, quantity: 4, color: getColor(1) },
      { id: 'light-box', width: 400, height: 200, depth: 300, weight: 5, quantity: 4, color: getColor(2) },
    ],
    options: {
      algorithm: 'layer-building',
      features: {
        supportCheck: true,
      },
    },
  },

  {
    id: 'container-40ft',
    nameKey: 'examples.container40ft.name',
    descriptionKey: 'examples.container40ft.description',
    category: 'realScenarios',
    icon: Truck,
    bins: [
      { id: '40ft', type: 'container', width: 2352, height: 2393, depth: 12032, maxWeight: 26000 },
    ],
    items: [
      { id: 'pallet-1', width: 800, height: 1500, depth: 1200, weight: 500, quantity: 3, color: getColor(0), deliveryOrder: 1, groupId: 'stop-1' },
      { id: 'pallet-2', width: 1000, height: 1400, depth: 1200, weight: 600, quantity: 3, color: getColor(1), deliveryOrder: 2, groupId: 'stop-2' },
      { id: 'pallet-3', width: 1100, height: 1600, depth: 1100, weight: 700, quantity: 4, color: getColor(2), deliveryOrder: 3, groupId: 'stop-3' },
    ],
    options: {
      algorithm: 'wall-building',
      constraints: {
        respectDeliveryOrder: true,
      },
    },
  },

  {
    id: 'eb-afit-demo',
    nameKey: 'examples.ebAfit.name',
    descriptionKey: 'examples.ebAfit.description',
    category: 'realScenarios',
    icon: Zap,
    bins: [
      { id: 'bin', type: 'box', width: 150, height: 120, depth: 150, maxWeight: 200 },
    ],
    items: [
      { id: 'item-1', width: 50, height: 40, depth: 50, weight: 10, quantity: 1, color: getColor(0) },
      { id: 'item-2', width: 40, height: 50, depth: 40, weight: 12, quantity: 1, color: getColor(1) },
      { id: 'item-3', width: 60, height: 30, depth: 45, weight: 8, quantity: 1, color: getColor(2) },
      { id: 'item-4', width: 35, height: 35, depth: 35, weight: 6, quantity: 1, color: getColor(3) },
      { id: 'item-5', width: 45, height: 25, depth: 55, weight: 9, quantity: 1, color: getColor(4) },
      { id: 'item-6', width: 30, height: 40, depth: 30, weight: 5, quantity: 1, color: getColor(5) },
      { id: 'item-7', width: 55, height: 20, depth: 40, weight: 7, quantity: 1, color: getColor(6) },
      { id: 'item-8', width: 25, height: 45, depth: 25, weight: 4, quantity: 1, color: getColor(7) },
    ],
    options: {
      algorithm: 'eb-afit',
      timeBudgetMs: 5000,
    },
  },

  {
    id: 'homogeneous-items',
    nameKey: 'examples.homogeneousItems.name',
    descriptionKey: 'examples.homogeneousItems.description',
    category: 'realScenarios',
    icon: Box,
    bins: [
      { id: 'bin', type: 'box', width: 240, height: 200, depth: 240, maxWeight: 500 },
    ],
    items: [
      { id: 'box', width: 60, height: 40, depth: 60, weight: 5, quantity: 20, color: getColor(0) },
    ],
    options: {
      algorithm: 'layer-building',
    },
  },
];

export function getExampleById(id: string): DemoExample | undefined {
  return DEMO_EXAMPLES.find((e) => e.id === id);
}

export function getExamplesByCategory(category: ExampleCategory): DemoExample[] {
  return DEMO_EXAMPLES.filter((e) => e.category === category);
}
