/**
 * Safe localStorage wrapper
 * Handles errors from private browsing, full storage, or restricted environments
 */

/**
 * Safely get an item from localStorage
 * Returns null if localStorage is unavailable or on any error
 */
export function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (error) {
    // localStorage may throw in private browsing mode or when disabled
    if (process.env.NODE_ENV === 'development') {
      console.warn('localStorage.getItem failed:', error);
    }
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * Returns true on success, false on failure
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // localStorage may throw when quota is exceeded or in private browsing
    if (process.env.NODE_ENV === 'development') {
      console.warn('localStorage.setItem failed:', error);
    }
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * Returns true on success, false on failure
 */
export function safeRemoveItem(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('localStorage.removeItem failed:', error);
    }
    return false;
  }
}
