// src/components/audio/useDrumPadConfig.js
import { useMemo } from "react";
import { usePersistedState } from "./usePersistedState";
import { DRUM_PADS } from "./SoundBoards/DrumMachine";

/**
 * Foundation for:
 * - user-custom pad layouts (reorder / rename / assign samples)
 * - user-custom keyboard bindings
 *
 * Today:
 * - pads + bindings are persisted in localStorage
 * - getPadForChar() returns the pad object for a given key press
 *
 * Later:
 * - sampleUrl can become an uploaded file URL, IndexedDB key, or backend URL
 */
const DEFAULT_KEY_BINDINGS = {
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  j: 4,
  k: 5,
  l: 6,
  ";": 7,
  q: 8,
  w: 9,
  e: 10,
  r: 11,
  u: 12,
  i: 13,
  o: 14,
  p: 15,
};

export function useDrumPadConfig() {
  const [pads, setPads] = usePersistedState("drum.pads.v1", DRUM_PADS);
  const [keyBindings, setKeyBindings] = usePersistedState(
    "drum.keyBindings.v1",
    DEFAULT_KEY_BINDINGS
  );

  const idToPad = useMemo(() => {
    const map = new Map();
    (pads || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [pads]);

  const getPadForChar = (charLower) => {
    const padId = keyBindings?.[charLower];
    if (padId == null) return null;
    return idToPad.get(padId) || null;
  };

  return {
    pads,
    setPads,
    keyBindings,
    setKeyBindings,
    getPadForChar,
  };
}
