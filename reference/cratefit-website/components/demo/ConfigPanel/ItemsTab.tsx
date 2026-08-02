'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { cn, safeParseNumber } from '@/lib/utils';
import { useDemoStore, type DemoItem } from '@/lib/stores/demo-store';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

// Safe ID pattern - only allow alphanumeric, underscore, and hyphen
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]*$/;
const sanitizeId = (value: string): string => {
  // Remove any characters that don't match the safe pattern
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 256);
};

const ROTATION_TYPES = [
  { value: 'all', labelKey: 'rotationTypes.all' },
  { value: 'horizontal', labelKey: 'rotationTypes.horizontal' },
  { value: 'fixed', labelKey: 'rotationTypes.fixed' },
] as const;

interface ItemCardProps {
  item: DemoItem;
  onUpdate: (updates: Partial<DemoItem>) => void;
  onRemove: () => void;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  setRef?: (el: HTMLDivElement | null) => void;
}

const ItemCard = memo(function ItemCard({ item, onUpdate, onRemove, isHighlighted, onMouseEnter, onMouseLeave, setRef }: ItemCardProps) {
  const t = useTranslations('demo');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvanced = item.weight || item.rotationType || item.maxStackWeight || item.groupId || item.deliveryOrder;

  return (
    <div
      ref={setRef}
      className={cn(
        'rounded-lg border bg-background p-3 transition-all duration-200',
        isHighlighted && 'border-primary bg-primary/5 ring-1 ring-primary/30'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={item.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="h-6 w-6 cursor-pointer rounded border-0 p-0"
            aria-label={`Color for item ${item.id}`}
            title="Press Enter to open color picker"
          />
          <input
            type="text"
            value={item.id}
            onChange={(e) => onUpdate({ id: sanitizeId(e.target.value) })}
            className="h-7 w-24 rounded border bg-card px-2 text-sm font-medium"
            placeholder="Item ID"
            maxLength={256}
            aria-label={`ID for item ${item.id}`}
          />
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Dimensions + Quantity */}
      <div className="mb-2 grid grid-cols-4 gap-2">
        {(['width', 'height', 'depth'] as const).map((dim) => (
          <div key={dim}>
            <label className="mb-1 block text-[10px] uppercase text-muted-foreground">
              {dim.charAt(0)}
            </label>
            <input
              type="number"
              value={item[dim]}
              onChange={(e) => onUpdate({ [dim]: safeParseNumber(e.target.value, 1, 1) })}
              className="h-7 w-full rounded border bg-card px-1 text-xs"
              min={1}
            />
          </div>
        ))}
        <div>
          <label className="mb-1 block text-[10px] uppercase text-muted-foreground">
            {t('qty')}
          </label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: safeParseNumber(e.target.value, 1, 1) })}
            className="h-7 w-full rounded border bg-card px-1 text-xs"
            min={1}
          />
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn(
          'flex w-full items-center justify-center gap-1 rounded py-1 text-xs transition-colors',
          hasAdvanced ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t('advancedOptions')}
        {hasAdvanced && <span className="ml-1 text-primary">*</span>}
      </button>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">{t('weight')}</label>
              <input
                type="number"
                value={item.weight ?? ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  onUpdate({ weight: e.target.value && !isNaN(num) ? num : undefined });
                }}
                className="h-7 w-full rounded border bg-card px-2 text-xs"
                placeholder="0"
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">{t('rotationType')}</label>
              <select
                value={item.rotationType ?? 'all'}
                onChange={(e) => onUpdate({ rotationType: e.target.value as DemoItem['rotationType'] })}
                className="h-7 w-full rounded border bg-card px-1 text-xs"
              >
                {ROTATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {t(type.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">{t('maxStackWeight')}</label>
              <input
                type="number"
                value={item.maxStackWeight ?? ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  onUpdate({ maxStackWeight: e.target.value && !isNaN(num) ? num : undefined });
                }}
                className="h-7 w-full rounded border bg-card px-2 text-xs"
                placeholder="∞"
                min={0}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-muted-foreground">{t('deliveryOrder')}</label>
              <input
                type="number"
                value={item.deliveryOrder ?? ''}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  onUpdate({ deliveryOrder: e.target.value && !isNaN(num) ? num : undefined });
                }}
                className="h-7 w-full rounded border bg-card px-2 text-xs"
                placeholder="0"
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">{t('groupId')}</label>
            <input
              type="text"
              value={item.groupId ?? ''}
              onChange={(e) => onUpdate({ groupId: e.target.value || undefined })}
              className="h-7 w-full rounded border bg-card px-2 text-xs"
              placeholder={t('groupIdPlaceholder')}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={item.requiresFloor ?? false}
                onChange={(e) => onUpdate({ requiresFloor: e.target.checked || undefined })}
                className="rounded border-muted-foreground"
              />
              {t('requiresFloor')}
            </label>
          </div>
        </div>
      )}
    </div>
  );
});

export function ItemsTab() {
  const t = useTranslations('demo');
  const items = useDemoStore((s) => s.items);
  const addItem = useDemoStore((s) => s.addItem);
  const updateItem = useDemoStore((s) => s.updateItem);
  const removeItem = useDemoStore((s) => s.removeItem);
  const highlightedItemId = useDemoStore((s) => s.highlight.itemId);
  const highlightSource = useDemoStore((s) => s.highlight.source);
  const setHighlight = useDemoStore((s) => s.setHighlight);
  const clearHighlight = useDemoStore((s) => s.clearHighlight);

  // Refs for each item card to enable auto-scroll
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Memoized handlers to prevent unnecessary re-renders
  const handleUpdateItem = useCallback((id: string, updates: Partial<DemoItem>) => {
    updateItem(id, updates);
  }, [updateItem]);

  const handleRemoveItem = useCallback((id: string) => {
    removeItem(id);
  }, [removeItem]);

  const handleMouseEnter = useCallback((id: string) => {
    setHighlight({ itemId: id, source: 'panel' });
  }, [setHighlight]);

  const handleMouseLeave = useCallback(() => {
    clearHighlight();
  }, [clearHighlight]);

  // Auto-scroll to highlighted item when highlighted from viewer
  useEffect(() => {
    if (highlightedItemId && highlightSource === 'viewer') {
      // Find the base item ID (handle expanded items like "item-1-2")
      const baseItemId = items.find((item) =>
        highlightedItemId === item.id || highlightedItemId.startsWith(`${item.id}-`)
      )?.id;

      if (baseItemId) {
        const element = itemRefs.current.get(baseItemId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [highlightedItemId, highlightSource, items]);

  const handleAddItem = () => {
    const colorIndex = items.length % COLORS.length;
    const color = COLORS[colorIndex] ?? '#3b82f6';
    addItem({
      id: `item-${Date.now()}`,
      width: 20,
      height: 20,
      depth: 20,
      quantity: 1,
      color,
    });
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('items')} ({items.length} {t('types')}, {totalItems} {t('total')})
        </h3>
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          {t('add')}
        </button>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {items.map((item) => {
          // Check if any expanded item from this base item is highlighted
          // Items expand to item-id-1, item-id-2, etc. when quantity > 1
          const isHighlighted = highlightedItemId !== null && (
            highlightedItemId === item.id ||
            highlightedItemId.startsWith(`${item.id}-`)
          );
          return (
            <ItemCard
              key={item.id}
              item={item}
              onUpdate={(updates) => handleUpdateItem(item.id, updates)}
              onRemove={() => handleRemoveItem(item.id)}
              isHighlighted={isHighlighted && highlightSource === 'viewer'}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              setRef={(el) => {
                if (el) {
                  itemRefs.current.set(item.id, el);
                } else {
                  itemRefs.current.delete(item.id);
                }
              }}
            />
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('noItems')}
        </div>
      )}
    </div>
  );
}
