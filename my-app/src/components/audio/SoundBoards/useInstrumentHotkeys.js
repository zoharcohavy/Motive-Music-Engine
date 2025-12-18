// src/components/audio/useInstrumentHotkeys.js
import { useEffect } from "react";

/**
 * Unified hotkeys:
 * - Space = play/pause
 * - Enter = toggle recording on selected track
 * - Any single character = trigger instrument mapping
 *
 * Does not hijack typing in inputs/textarea/contenteditable.
 */
export function useInstrumentHotkeys({ onPlay, onToggleRecord, triggerChar }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }

      // Space toggles transport
      if (e.code === "Space") {
        e.preventDefault();
        onPlay?.();
        return;
      }

      // Enter toggles recording
      if (e.key === "Enter") {
        e.preventDefault();
        onToggleRecord?.();
        return;
      }

      // Single character triggers instrument mapping
      if (e.key && e.key.length === 1) {
        triggerChar?.(e.key.toLowerCase());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPlay, onToggleRecord, triggerChar]);
}
