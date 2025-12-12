// src/components/audio/usePersistedState.js
import { useEffect, useState } from "react";

/**
 * localStorage-backed state.
 * Works now, and later you can swap storage for IndexedDB without changing callers.
 */
export function usePersistedState(storageKey, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw == null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore write failures
    }
  }, [storageKey, value]);

  return [value, setValue];
}
