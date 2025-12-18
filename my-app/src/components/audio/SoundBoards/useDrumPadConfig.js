import { useMemo, useCallback } from "react";
import { usePersistedState } from "../../ui/usePersistedState";
import { DRUM_PADS } from "./DrumMachine";

const STORAGE_PADS_KEY = "drumPads:v1";
const STORAGE_BINDS_KEY = "drumKeyBinds:v1";

// A sensible default 4x4 layout (row-major)
const DEFAULT_PAD_KEYS = [
  "1", "2", "3", "4",
  "q", "w", "e", "r",
  "a", "s", "d", "f",
  "z", "x", "c", "v",
];

// builds { "q": 4, ... }
function buildDefaultBindings() {
  const binds = {};
  for (let i = 0; i < 16; i++) binds[DEFAULT_PAD_KEYS[i]] = i;
  return binds;
}

function normalizeChar(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  return s.length ? s[0] : "";
}

export function useDrumPadConfig() {
  const [pads, setPads] = usePersistedState(STORAGE_PADS_KEY, DRUM_PADS);
  const [keyBindings, setKeyBindings] = usePersistedState(
    STORAGE_BINDS_KEY,
    buildDefaultBindings()
  );

  const idToPad = useMemo(() => {
    const m = new Map();
    (pads || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [pads]);

  // Invert bindings => { padId: "q" } (first match wins)
  const padIdToChar = useMemo(() => {
    const inv = {};
    for (const [ch, padId] of Object.entries(keyBindings || {})) {
      if (inv[padId] == null) inv[padId] = ch;
    }
    return inv;
  }, [keyBindings]);

  const getPadForChar = useCallback(
    (charLower) => {
      const ch = normalizeChar(charLower);
      if (!ch) return null;
      const padId = keyBindings?.[ch];
      if (padId == null) return null;
      return idToPad.get(padId) || null;
    },
    [keyBindings, idToPad]
  );

  const getCharForPadId = useCallback(
    (padId) => {
      return padIdToChar?.[padId] || "";
    },
    [padIdToChar]
  );

  // Reassign a keyboard key to a pad:
  // - removes old key assigned to this pad (if any)
  // - removes whoever currently owns the new key
  const setPadKey = useCallback((padId, newChar) => {
    const ch = normalizeChar(newChar);
    if (!ch) return;

    setKeyBindings((prev) => {
      const next = { ...(prev || {}) };

      // remove any existing key bound to this pad
      for (const [k, v] of Object.entries(next)) {
        if (v === padId) delete next[k];
      }

      // claim the new key for this pad
      next[ch] = padId;

      return next;
    });
  }, [setKeyBindings]);

  const setPadName = useCallback((padId, newName) => {
    setPads((prev) =>
      (prev || []).map((p) =>
        p.id === padId ? { ...p, name: newName } : p
      )
    );
  }, [setPads]);

  // Store sample as a data: URL so it persists in localStorage.
  // (Works best for short samples; localStorage size is limited.)
  const setPadSampleFile = useCallback((padId, file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setPads((prev) =>
        (prev || []).map((p) =>
          p.id === padId ? { ...p, sampleUrl: dataUrl, sampleName: file.name } : p
        )
      );
    };
    reader.readAsDataURL(file);
  }, [setPads]);

  const FORBIDDEN_KEYS = new Set([" ", "enter"]); // space and enter are reserved globally

  const normalizeChar = (key) => {
    if (!key) return "";
    const s = String(key).toLowerCase();
    // Spacebar arrives as " " in e.key; Enter arrives as "Enter"
    if (s === "enter") return "enter";
    if (s === " ") return " ";
    return s.length === 1 ? s : "";
  };

  return {
    pads,
    setPads,

    keyBindings,
    setKeyBindings,

    getPadForChar,
    getCharForPadId,

    setPadKey,
    setPadName,
    setPadSampleFile,
    getCharForPadId,
  };
}
