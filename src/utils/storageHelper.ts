import { useEffect, useRef } from 'react';

/**
 * Robust LocalStorage reading with error handling and fallback
 */
export const getLocalCache = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch (err) {
    console.warn(`[StorageHelper] Gagal membaca cache ${key}:`, err);
    return fallback;
  }
};

/**
 * Direct safe LocalStorage writer with quota check
 */
export const setLocalCache = (key: string, data: any): boolean => {
  try {
    if (data === undefined) {
      localStorage.removeItem(key);
      return true;
    }
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    console.warn(`[StorageHelper] Gagal menyimpan cache ${key}:`, err);
    return false;
  }
};

/**
 * Custom React Hook for debounced LocalStorage auto-sync with Dirty Checking.
 * Ensures fast keystrokes / frequent state updates do not choke I/O or spam localStorage.
 */
export function useDebouncedLocalStorage<T>(key: string, value: T, delayMs: number = 350) {
  const prevSerializedRef = useRef<string | null>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Skip writing if first mount and value is already cached (prevents rewriting clean boot state)
    if (isFirstMount.current) {
      isFirstMount.current = false;
      try {
        prevSerializedRef.current = JSON.stringify(value);
      } catch {
        // ignore
      }
      return;
    }

    const handler = setTimeout(() => {
      try {
        const nextSerialized = JSON.stringify(value);
        // Dirty checking: Only write if data actually changed
        if (nextSerialized !== prevSerializedRef.current) {
          localStorage.setItem(key, nextSerialized);
          prevSerializedRef.current = nextSerialized;
        }
      } catch (err) {
        console.warn(`[StorageHelper] Debounced save failed for ${key}:`, err);
      }
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [key, value, delayMs]);
}
