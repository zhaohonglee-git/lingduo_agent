import type { PackingInstructions, InstructionsExportOptions } from '../types';

export function formatAsJson(
  instructions: PackingInstructions,
  options: InstructionsExportOptions
): string {
  // Create a clean export structure
  const exportData = {
    binId: instructions.binId,
    binDimensions: instructions.binDimensions,
    totalItems: instructions.totalItems,
    totalLayers: instructions.totalLayers,
    utilization: instructions.utilization,
    summary: instructions.summary,
    steps: instructions.steps.map((step) => ({
      stepNumber: step.stepNumber,
      layer: step.layer,
      action: step.action,
      itemId: step.item.item.id,
      itemDimensions: {
        width: step.item.item.width,
        height: step.item.item.height,
        depth: step.item.item.depth,
      },
      ...(options.includePositions && {
        position: {
          x: step.position.x,
          y: step.position.y,
          z: step.position.z,
          description: step.position.description,
        },
      }),
      orientation: step.orientation,
      rotation: step.rotation,
      ...(options.includeNotes && step.notes.length > 0 && {
        notes: step.notes,
      }),
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
