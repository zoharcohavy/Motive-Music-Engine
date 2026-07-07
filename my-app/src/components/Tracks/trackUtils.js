// Shared track/timeline helpers.
// Single source of truth for values that useTrackModel, useTransport, and
// useRecording previously each defined locally (with "keep in sync" comments).

export const BASE_STRIP_SECONDS = 10;

export const DEFAULT_TRACK_HEIGHT_PX = 84;
export const MIN_TRACK_HEIGHT_PX = 34;
export const MAX_TRACK_HEIGHT_PX = 220;

export const getTrackLength = (track) => {
  const zoom = track?.zoom || 1;
  return BASE_STRIP_SECONDS / zoom;
};

export const clipsOverlap = (a, b) => {
  const aStart = a.startTime || 0;
  const aEnd = aStart + (a.duration || 0);
  const bStart = b.startTime || 0;
  const bEnd = bStart + (b.duration || 0);
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

export const willOverlap = (clips, candidate, ignoreId = null) =>
  (clips || []).some((c) => {
    if (ignoreId && c.id === ignoreId) return false;
    return clipsOverlap(c, candidate);
  });

export const makeClipId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const makeTrack = (id, { zoom = 1 } = {}) => ({
  id,
  name: String(id),
  zoom,
  headPos: 0, // 0..1 across the strip
  clips: [], // [{ id, url, duration, startTime, offset, image }]
  effects: [],
  isMuted: false,
  isSolo: false,
  isRecEnabled: false,
  inputDeviceId: null,
  instrumentType: "guitar",
  tapeFx: { saturation: 0, wowFlutter: 0, eqRollOff: 0, hiss: 0 },
  heightPx: DEFAULT_TRACK_HEIGHT_PX,
  // tapeHeadPos mirrors headPos; useTransport and TrackSection still read it
  // as a fallback when headPos is missing.
  tapeHeadPos: 0,
});
