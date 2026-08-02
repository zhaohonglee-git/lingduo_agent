import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import type { BinSpec, PackOptions } from '@cratefit/pack';
import type { DemoItem } from './stores/demo-store';

export interface DemoConfig {
  bins: BinSpec[];
  items: DemoItem[];
  options: PackOptions;
}

// Strict validation schema for URL/file config
// Limits prevent excessive memory usage from malicious payloads
const MAX_BINS = 100;
const MAX_ITEMS = 1000;
const MAX_STRING_LENGTH = 256;
const MAX_DIMENSION = 1000000; // 1 million units max

// Safe ID pattern - only allow alphanumeric, underscore, and hyphen
// This prevents XSS and injection attacks from malicious config files/URLs
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const binSchema = z.object({
  id: z.string().min(1).max(MAX_STRING_LENGTH).refine(
    (id) => SAFE_ID_PATTERN.test(id),
    { message: 'ID must only contain alphanumeric, underscore, and hyphen characters' }
  ),
  type: z.enum(['box', 'pallet', 'container', 'truck', 'shelf', 'custom']).optional(),
  width: z.number().positive().max(MAX_DIMENSION),
  height: z.number().positive().max(MAX_DIMENSION),
  depth: z.number().positive().max(MAX_DIMENSION),
  maxWeight: z.number().positive().max(MAX_DIMENSION).optional(),
  cost: z.number().nonnegative().max(MAX_DIMENSION).optional(),
  // Allow known optional fields
  excludeZones: z.array(z.object({
    minX: z.number(),
    maxX: z.number(),
    minY: z.number(),
    maxY: z.number(),
    minZ: z.number(),
    maxZ: z.number(),
  })).optional(),
});

const itemSchema = z.object({
  id: z.string().min(1).max(MAX_STRING_LENGTH).refine(
    (id) => SAFE_ID_PATTERN.test(id),
    { message: 'ID must only contain alphanumeric, underscore, and hyphen characters' }
  ),
  width: z.number().positive().max(MAX_DIMENSION),
  height: z.number().positive().max(MAX_DIMENSION),
  depth: z.number().positive().max(MAX_DIMENSION),
  quantity: z.number().int().positive().max(MAX_ITEMS),
  color: z.string().min(1).max(MAX_STRING_LENGTH),
  // Allow known optional fields
  weight: z.number().nonnegative().max(MAX_DIMENSION).optional(),
  rotationType: z.enum(['all', 'horizontal', 'vertical', 'fixed']).optional(),
  groupId: z.string().max(MAX_STRING_LENGTH).optional(),
  incompatibleWith: z.array(z.string().max(MAX_STRING_LENGTH)).optional(),
  maxStackWeight: z.number().nonnegative().optional(),
  requiresFloor: z.boolean().optional(),
  requiresSupport: z.number().min(0).max(1).optional(),
  deliveryOrder: z.number().int().positive().optional(),
});

const optionsSchema = z.object({
  algorithm: z.enum([
    'extreme-point',
    'layer-building',
    'wall-building',
    'eb-afit',
    'skyline',
  ]).optional(),
  binSelection: z.enum(['first-fit', 'best-fit', 'worst-fit', 'spread']).optional(),
  timeBudgetMs: z.number().int().positive().max(60000).optional(),
  features: z.object({
    supportCheck: z.boolean().optional(),
    stackingLimit: z.boolean().optional(),
  }).optional(),
  constraints: z.object({
    enforceIncompatibility: z.boolean().optional(),
    keepGroupsTogether: z.boolean().optional(),
    respectDeliveryOrder: z.boolean().optional(),
  }).optional(),
  optimize: z.object({
    target: z.enum(['utilization', 'cost', 'bins']).optional(),
  }).optional(),
}).optional();

const urlConfigSchema = z.object({
  bins: z.array(binSchema).min(1).max(MAX_BINS),
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
  options: optionsSchema,
});

/**
 * Compress and encode configuration to URL-safe string
 * Returns null if serialization fails (e.g., circular references)
 */
export function encodeConfig(config: DemoConfig): string | null {
  try {
    const json = JSON.stringify(config);
    return compressToEncodedURIComponent(json);
  } catch (error) {
    console.error('Failed to encode config:', error);
    return null;
  }
}

// Size limits to prevent decompression bomb attacks
const MAX_ENCODED_LENGTH = 50000; // 50KB max compressed
const MAX_DECODED_LENGTH = 1000000; // 1MB max decompressed

/**
 * Decode and decompress configuration from URL-safe string
 * Protected against decompression bomb attacks with size limits
 */
export function decodeConfig(encoded: string): DemoConfig | null {
  try {
    // Check compressed size before decompression
    if (encoded.length > MAX_ENCODED_LENGTH) {
      console.warn('URL config too large (compressed):', encoded.length);
      return null;
    }

    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;

    // Check decompressed size to prevent memory exhaustion
    if (json.length > MAX_DECODED_LENGTH) {
      console.warn('URL config too large (decompressed):', json.length);
      return null;
    }

    const parsed = JSON.parse(json);

    // Validate with Zod schema
    const result = urlConfigSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('Invalid URL config:', result.error.issues);
      return null;
    }

    return result.data as DemoConfig;
  } catch {
    return null;
  }
}

/**
 * Get config from URL hash
 */
export function getConfigFromUrl(): DemoConfig | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) return null;

  // Check if it starts with config=
  const params = new URLSearchParams(hash);
  const encoded = params.get('config');

  if (!encoded) return null;
  return decodeConfig(encoded);
}

/**
 * Set config to URL hash
 * Returns false if encoding fails
 */
export function setConfigToUrl(config: DemoConfig): boolean {
  if (typeof window === 'undefined') return false;

  const encoded = encodeConfig(config);
  if (!encoded) return false;

  const params = new URLSearchParams();
  params.set('config', encoded);

  window.history.replaceState(null, '', `#${params.toString()}`);
  return true;
}

/**
 * Generate shareable URL with configuration
 * Returns null if encoding fails
 */
export function generateShareUrl(config: DemoConfig): string | null {
  const encoded = encodeConfig(config);
  if (!encoded) return null;

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';

  return `${baseUrl}#config=${encoded}`;
}

/**
 * Download configuration as JSON file
 * Returns false if serialization fails
 */
export function downloadConfigAsJson(config: DemoConfig, filename = 'cratefit-config.json'): boolean {
  try {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Failed to export config:', error);
    return false;
  }
}

/**
 * Read configuration from JSON file
 */
export function readConfigFromFile(file: File): Promise<DemoConfig | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        // Validate with Zod schema (same as URL config)
        const result = urlConfigSchema.safeParse(parsed);
        if (!result.success) {
          console.warn('Invalid file config:', result.error.issues);
          resolve(null);
          return;
        }

        resolve(result.data as DemoConfig);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
