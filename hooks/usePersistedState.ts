import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";

type Options<T> = {
  key: string;
  initialValue: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  debounceMs?: number;
};

/**
 * usePersistedState
 * Thin wrapper around useState + localStorage with optional debounce and custom (de)serializers.
 */
export function usePersistedState<T>(options: Options<T>): [T, Dispatch<SetStateAction<T>>] {
  const { key, initialValue, serialize = JSON.stringify, deserialize = JSON.parse, debounceMs = 0 } = options;
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return deserialize(stored);
    } catch (e) {
      console.warn(`usePersistedState: failed to read ${key}`, e);
    }
    return initialValue;
  });

  const timeoutRef = useRef<number | null>(null);

  // Sync state between multiple hook instances using same key
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = deserialize(e.newValue);
          setState(newValue);
        } catch (err) {
          console.warn(`usePersistedState sync error for ${key}`, err);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, deserialize]);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const save = () => {
      try {
        const serialized = serialize(state);
        const current = localStorage.getItem(key);
        if (current !== serialized) {
          localStorage.setItem(key, serialized);
          // Manually dispatch storage event within same window
          window.dispatchEvent(new StorageEvent("storage", { key, newValue: serialized }));
        }
      } catch (e) {
        console.warn(`usePersistedState: failed to write ${key}`, e);
      }
    };

    if (debounceMs > 0) {
      timeoutRef.current = window.setTimeout(save, debounceMs);
      return () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      };
    }

    save();
  }, [state, key, serialize, debounceMs]);

  return [state, setState];
}
