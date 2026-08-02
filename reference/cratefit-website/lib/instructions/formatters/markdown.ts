import type { PackingInstructions, InstructionsExportOptions, InstructionStep } from '../types';

const TRANSLATIONS = {
  en: {
    title: 'Packing Instructions',
    summary: 'Summary',
    binDimensions: 'Bin Dimensions',
    totalItems: 'Total Items',
    totalLayers: 'Total Layers',
    utilization: 'Utilization',
    totalWeight: 'Total Weight',
    layer: 'Layer',
    step: 'Step',
    place: 'Place',
    stack: 'Stack',
    rotate: 'Rotate and place',
    at: 'at position',
    orientation: 'Orientation',
    upright: 'upright',
    flat: 'flat',
    sideways: 'sideways',
    notes: 'Notes',
    position: {
      corner: 'in the corner',
      edge: 'along the edge',
      center: 'in the center',
      adjacent: 'adjacent to other items',
    },
    noteTranslations: {
      'heavy-item': 'Heavy item - use caution',
      'floor-required': 'Must be placed on floor',
      'fragile-stacking': 'Fragile - limited stacking',
      'fixed-orientation': 'Fixed orientation required',
      'horizontal-only': 'Horizontal rotation only',
    },
  },
  'zh-TW': {
    title: '裝箱指示',
    summary: '摘要',
    binDimensions: '容器尺寸',
    totalItems: '總物品數',
    totalLayers: '總層數',
    utilization: '利用率',
    totalWeight: '總重量',
    layer: '層',
    step: '步驟',
    place: '放置',
    stack: '堆疊',
    rotate: '旋轉放置',
    at: '於位置',
    orientation: '方向',
    upright: '直立',
    flat: '平放',
    sideways: '側放',
    notes: '備註',
    position: {
      corner: '於角落',
      edge: '沿邊緣',
      center: '於中央',
      adjacent: '相鄰於其他物品',
    },
    noteTranslations: {
      'heavy-item': '重物 - 請小心處理',
      'floor-required': '必須放置於地面',
      'fragile-stacking': '易碎品 - 限制堆疊',
      'fixed-orientation': '須維持固定方向',
      'horizontal-only': '僅限水平旋轉',
    },
  },
} as const;

type TranslationType = typeof TRANSLATIONS['en'];

function translateNote(note: string, lang: 'en' | 'zh-TW'): string {
  const t = TRANSLATIONS[lang] as TranslationType;
  if (note.startsWith('group:')) {
    const groupId = note.replace('group:', '');
    return lang === 'en' ? `Group: ${groupId}` : `群組：${groupId}`;
  }
  return t.noteTranslations[note as keyof typeof t.noteTranslations] ?? note;
}

export function formatAsMarkdown(
  instructions: PackingInstructions,
  options: InstructionsExportOptions
): string {
  const t = TRANSLATIONS[options.language] as TranslationType;
  const lines: string[] = [];

  // Title
  lines.push(`# ${t.title}`);
  lines.push('');

  // Summary
  lines.push(`## ${t.summary}`);
  lines.push('');
  lines.push(
    `- **${t.binDimensions}:** ${instructions.binDimensions.width} × ${instructions.binDimensions.height} × ${instructions.binDimensions.depth}`
  );
  lines.push(`- **${t.totalItems}:** ${instructions.totalItems}`);
  lines.push(`- **${t.totalLayers}:** ${instructions.totalLayers}`);
  lines.push(`- **${t.utilization}:** ${(instructions.utilization * 100).toFixed(1)}%`);
  if (instructions.summary.totalWeight > 0) {
    lines.push(`- **${t.totalWeight}:** ${instructions.summary.totalWeight}`);
  }
  lines.push('');

  // Steps
  if (options.groupByLayer) {
    // Group steps by layer
    const stepsByLayer = new Map<number, InstructionStep[]>();
    for (const step of instructions.steps) {
      const layerSteps = stepsByLayer.get(step.layer) ?? [];
      layerSteps.push(step);
      stepsByLayer.set(step.layer, layerSteps);
    }

    for (const [layer, steps] of stepsByLayer) {
      lines.push(`## ${t.layer} ${layer}`);
      lines.push('');

      for (const step of steps) {
        lines.push(formatStep(step, t, options));
      }
      lines.push('');
    }
  } else {
    // Sequential steps
    lines.push('## Steps');
    lines.push('');

    for (const step of instructions.steps) {
      lines.push(formatStep(step, t, options));
    }
  }

  return lines.join('\n');
}

function formatStep(
  step: InstructionStep,
  t: TranslationType,
  options: InstructionsExportOptions
): string {
  const actionWord = t[step.action];
  const itemId = step.item.item.id;
  const { width, height, depth } = step.item.item;
  const positionDesc = t.position[step.position.description];
  const orientationDesc = t[step.orientation];

  let line = `**${t.step} ${step.stepNumber}:** ${actionWord} \`${itemId}\` (${width}×${height}×${depth})`;

  if (options.includePositions) {
    line += ` ${t.at} (${step.position.x}, ${step.position.y}, ${step.position.z}) ${positionDesc}`;
  }

  line += ` - ${t.orientation}: ${orientationDesc}`;

  if (options.includeNotes && step.notes.length > 0) {
    const translatedNotes = step.notes
      .map((n) => translateNote(n, options.language))
      .join(', ');
    line += ` [${translatedNotes}]`;
  }

  return line;
}
