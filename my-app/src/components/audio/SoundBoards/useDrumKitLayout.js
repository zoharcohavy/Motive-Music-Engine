import { useMemo } from "react";
import { usePersistedState } from "../../ui/usePersistedState";

// Anchors are normalized (0..1) positions relative to the drum image box.
// You WILL tune these later, but they work as a starting map.
export const DRUM_ZONES = [
  { id: "hihat_1", label: "Hi-hat", x: 0.18, y: 0.22 },
  { id: "hihat_2", label: "Hi-hat 2", x: 0.24, y: 0.26 },

  { id: "crash_1", label: "Crash", x: 0.72, y: 0.14 },
  { id: "crash_2", label: "Crash 2", x: 0.82, y: 0.20 },

  { id: "splash_1", label: "Splash", x: 0.55, y: 0.18 },

  { id: "snare_1", label: "Snare", x: 0.36, y: 0.44 },
  { id: "snare_2", label: "Snare 2", x: 0.40, y: 0.48 },

  { id: "kick_1", label: "Kick", x: 0.48, y: 0.70 },
  { id: "kick_2", label: "Kick 2", x: 0.52, y: 0.72 },

  { id: "tom_1", label: "Tom", x: 0.58, y: 0.46 },
  { id: "tom_2", label: "Tom 2", x: 0.66, y: 0.52 },
  { id: "tom_3", label: "Tom 3", x: 0.50, y: 0.50 },

    // “spare keys on the side” zones
  { id: "side_1", label: "Spare 1", x: 0.93, y: 0.18 },
  { id: "side_2", label: "Spare 2", x: 0.93, y: 0.30 },
  { id: "side_3", label: "Spare 3", x: 0.93, y: 0.42 },
  { id: "side_4", label: "Spare 4", x: 0.93, y: 0.54 },
  { id: "side_5", label: "Spare 5", x: 0.93, y: 0.66 },
  { id: "side_6", label: "Spare 6", x: 0.93, y: 0.78 },

];

const defaultZoneForIndex = (i) => {
  // Layout:
  // Top row (6): cymbals/hihats/crash/splash
  // Tom row (3)
  // Snare+Hat row (3)
  // Kick row (2)
  // Remaining (2) on side
  const zones = [
    // top cymbals row (0..5)
    "hihat_1", "hihat_2", "splash_1", "crash_1", "crash_2", "splash_1",

    // tom row (6..8)
    "tom_1", "tom_2", "tom_3",

    // snare/hat row (9..11)
    "snare_1", "snare_2", "hihat_1",

    // kick row (12..13)
    "kick_1", "kick_2",

    // side spares (14..15)
    "side_3", "side_5",
  ];
  return zones[i] || "side_6";
};


// Pad anchors: { [padId]: { zoneId, offset: {x,y} } }
// offset is normalized, so it scales naturally with image resizing.
export function useDrumKitLayout(pads = []) {
  const [drumScale, setDrumScale] = usePersistedState("ui.drums.scale", 1.35); // bigger default
  const [keyOpacity, setKeyOpacity] = usePersistedState("ui.drums.keyOpacity", 0.55);

  const [padAnchors, setPadAnchors] = usePersistedState("ui.drums.padAnchors", {});

  // Fill missing anchors for pads (non-destructive)
  const anchors = useMemo(() => {
    const next = { ...(padAnchors || {}) };
    pads.forEach((p, i) => {
      const padId = p?.id ?? String(i);
      if (!next[padId]) {
        next[padId] = { zoneId: defaultZoneForIndex(i), offset: { x: 0, y: 0 } };
      }
    });
    return next;
  }, [padAnchors, pads]);

  const setPadAnchor = (padId, zoneId, offset) => {
    setPadAnchors((prev) => ({
      ...(prev || {}),
      [padId]: { zoneId, offset: offset || { x: 0, y: 0 } },
    }));
  };

  const setPadOffset = (padId, offset) => {
    setPadAnchors((prev) => {
      const curr = (prev && prev[padId]) || { zoneId: "snare_1", offset: { x: 0, y: 0 } };
      return { ...(prev || {}), [padId]: { ...curr, offset } };
    });
  };

  const resetLayout = () => {
    const next = {};
    pads.forEach((p, i) => {
      const padId = p?.id ?? String(i);
      next[padId] = { zoneId: defaultZoneForIndex(i), offset: { x: 0, y: 0 } };
    });
    setPadAnchors(next);
    setDrumScale(1.35);
    setKeyOpacity(0.55);
  };

  return {
    zones: DRUM_ZONES,
    anchors,
    drumScale,
    setDrumScale,
    keyOpacity,
    setKeyOpacity,
    setPadAnchor,
    setPadOffset,
    resetLayout,
  };
}
