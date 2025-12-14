// src/components/audio/useInstrumentHotkeys.js
import { useEffect } from "react";

/**
 * Unified hotkeys:
 * - Space = play/pause (or play from tapehead)
 * - Enter = toggle recording on selected track
 * - Any single character = trigger instrument key/pad via triggerChar(charLower)
 *
 * Best practice: do NOT hijack typing in inputs/textarea/contenteditable.
 */
export function useInstrumentHotkeys({ onPlay, onToggleRecord, triggerChar }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onPlay?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onToggleRecord?.();
        return;
      }

      // single character triggers instrument mapping
      if (e.key && e.key.length === 1) {
        const char = e.key.toLowerCase();
        triggerChar?.(char);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPlay, onToggleRecord, triggerChar]);
}
