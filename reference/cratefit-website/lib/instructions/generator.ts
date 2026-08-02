import type { PackedBin, PlacedItem } from '@cratefit/pack';
import type {
  PackingInstructions,
  InstructionStep,
  ActionType,
  PositionDescription,
  Orientation,
} from './types';

// Calculate which layer an item belongs to based on Y position
function calculateLayer(y: number, binHeight: number, allYPositions: number[]): number {
  // Sort unique Y positions and find index
  const uniqueYs = [...new Set(allYPositions)].sort((a, b) => a - b);
  const layerIndex = uniqueYs.findIndex((pos) => pos === y);
  return layerIndex >= 0 ? layerIndex + 1 : 1;
}

// Determine action type based on position
function getActionType(item: PlacedItem, layerNumber: number): ActionType {
  if (layerNumber > 1) return 'stack';
  if (item.rotation !== 0) return 'rotate';
  return 'place';
}

// Describe position relative to bin
function getPositionDescription(
  x: number,
  y: number,
  z: number,
  binWidth: number,
  binHeight: number,
  binDepth: number,
  itemWidth: number,
  itemDepth: number
): PositionDescription {
  const isAtLeftEdge = x <= 1;
  const isAtRightEdge = x + itemWidth >= binWidth - 1;
  const isAtFrontEdge = z <= 1;
  const isAtBackEdge = z + itemDepth >= binDepth - 1;

  const corners =
    (isAtLeftEdge || isAtRightEdge ? 1 : 0) + (isAtFrontEdge || isAtBackEdge ? 1 : 0);

  if (corners === 2) return 'corner';
  if (corners === 1) return 'edge';

  // Check if roughly centered
  const centerX = binWidth / 2;
  const centerZ = binDepth / 2;
  const itemCenterX = x + itemWidth / 2;
  const itemCenterZ = z + itemDepth / 2;
  const tolerance = Math.min(binWidth, binDepth) * 0.2;

  if (
    Math.abs(itemCenterX - centerX) < tolerance &&
    Math.abs(itemCenterZ - centerZ) < tolerance
  ) {
    return 'center';
  }

  return 'adjacent';
}

// Determine orientation based on rotation
function getOrientation(rotation: number, item: PlacedItem): Orientation {
  // Rotation encodes the orientation as a number 0-5
  // 0-1: upright (standing)
  // 2-3: flat (lying on largest face)
  // 4-5: sideways (on side)
  if (rotation <= 1) return 'upright';
  if (rotation <= 3) return 'flat';
  return 'sideways';
}

// Generate notes for an item placement
function generateNotes(item: PlacedItem, layerNumber: number): string[] {
  const notes: string[] = [];

  // Weight warning
  if (item.item.weight && item.item.weight > 20) {
    notes.push('heavy-item');
  }

  // Floor requirement
  if (item.item.requiresFloor && layerNumber === 1) {
    notes.push('floor-required');
  }

  // Stack weight limit
  if (item.item.maxStackWeight) {
    notes.push('fragile-stacking');
  }

  // Group info
  if (item.item.groupId) {
    notes.push(`group:${item.item.groupId}`);
  }

  // Rotation constraints
  if (item.item.rotationType === 'fixed') {
    notes.push('fixed-orientation');
  } else if (item.item.rotationType === 'horizontal') {
    notes.push('horizontal-only');
  }

  return notes;
}

export function generateInstructions(packedBin: PackedBin): PackingInstructions {
  const { bin, items, utilization } = packedBin;

  // Sort items by Y position (bottom to top), then by position
  const sortedItems = [...items].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    if (a.position.z !== b.position.z) return a.position.z - b.position.z;
    return a.position.x - b.position.x;
  });

  // Extract all Y positions to calculate layers
  const allYPositions = items.map((item) => item.position.y);

  // Generate steps
  const steps: InstructionStep[] = sortedItems.map((item, index) => {
    const layerNumber = calculateLayer(item.position.y, bin.height, allYPositions);
    const { x, y, z } = item.position;
    const { width, height, depth } = item.item;

    return {
      stepNumber: index + 1,
      layer: layerNumber,
      action: getActionType(item, layerNumber),
      item,
      position: {
        x,
        y,
        z,
        description: getPositionDescription(x, y, z, bin.width, bin.height, bin.depth, width, depth),
      },
      orientation: getOrientation(item.rotation, item),
      rotation: item.rotation,
      notes: generateNotes(item, layerNumber),
    };
  });

  // Calculate summary
  const totalWeight = items.reduce((sum, item) => sum + (item.item.weight || 0), 0);
  const heaviestItem = items.reduce<PlacedItem | null>((heaviest, item) => {
    if (!heaviest) return item;
    return (item.item.weight || 0) > (heaviest.item.weight || 0) ? item : heaviest;
  }, null);

  const groupsPresent = [...new Set(items.map((i) => i.item.groupId).filter(Boolean))] as string[];

  const uniqueLayers = new Set(steps.map((s) => s.layer));

  return {
    binId: bin.id,
    binDimensions: {
      width: bin.width,
      height: bin.height,
      depth: bin.depth,
    },
    totalItems: items.length,
    totalLayers: uniqueLayers.size,
    utilization,
    steps,
    summary: {
      totalWeight,
      heaviestItem: heaviestItem?.item.id ?? null,
      groupsPresent,
    },
  };
}
