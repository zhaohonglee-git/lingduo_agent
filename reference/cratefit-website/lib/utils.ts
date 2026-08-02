import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a number from input, returning fallback if invalid
 * @param value - Input value to parse
 * @param fallback - Default value if parsing fails (default: 1)
 * @param min - Minimum allowed value (default: 0)
 */
export function safeParseNumber(
  value: string | number,
  fallback: number = 1,
  min: number = 0
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num) || num < min) {
    return fallback;
  }
  return num;
}
