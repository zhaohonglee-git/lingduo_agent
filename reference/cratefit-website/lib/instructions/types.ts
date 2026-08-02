import type { PlacedItem, PackedBin } from '@cratefit/pack';

export type ActionType = 'place' | 'stack' | 'rotate';
export type PositionDescription = 'corner' | 'edge' | 'center' | 'adjacent';
export type Orientation = 'upright' | 'flat' | 'sideways';

export interface InstructionStep {
  stepNumber: number;
  layer: number;
  action: ActionType;
  item: PlacedItem;
  position: {
    x: number;
    y: number;
    z: number;
    description: PositionDescription;
    relativeToId?: string;
  };
  orientation: Orientation;
  rotation: number;
  notes: string[];
}

export interface PackingInstructions {
  binId: string;
  binDimensions: {
    width: number;
    height: number;
    depth: number;
  };
  totalItems: number;
  totalLayers: number;
  utilization: number;
  steps: InstructionStep[];
  summary: {
    totalWeight: number;
    heaviestItem: string | null;
    groupsPresent: string[];
  };
}

export interface InstructionsExportOptions {
  language: 'en' | 'zh-TW';
  includeNotes: boolean;
  includePositions: boolean;
  groupByLayer: boolean;
}
