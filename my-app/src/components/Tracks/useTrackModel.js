// useTrackModel.js
import { useRef, useState, useEffect } from "react";
import { drawGenericWave } from "../audio/drawUtils";
import { useTransport } from "./useTransport";

/**
 * Track model + drawing + mouse interaction (head + clip drag)
 *
 * This hook owns:
 * - tracks state
 * - global zoom
 * - selected track
 * - active recording track id
 * - track canvases + drawing
 * - dragging tape-head and clips
 */
export function useTrackModel(options = {}) {
  // ---------- State ----------
  const [tracks, setTracks] = useState([
    {
      id: 0,
      zoom: 1, //fix later
      headPos: 0, // 0..1 across the strip
      clips: [], // [{ id, url, duration, startTime, image }]
      // legacy fields (kept so old code doesn’t crash if it still references them):
      hasRecording: false,
      recordingUrl: null,
      recordingDuration: 0,
      tapeHeadPos: 0,
      recordingImage: null,
      clipStartPos: 0,
    },
  ]);

  // Track UI sizing
  const BASE_STRIP_SECONDS = 10;
  const DEFAULT_TRACK_HEIGHT_PX = 84; // matches current feel
  const MIN_TRACK_HEIGHT_PX = 34;
  const MAX_TRACK_HEIGHT_PX = 220;

  const [nextTrackId, setNextTrackId] = useState(1);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [viewStartTime, setViewStartTime] = useState(0); // left edge in seconds
  const [headTimeSeconds, setHeadTimeSeconds] = useState(0); // absolute playhead time in seconds
  const [activeRecordingTrackId, setActiveRecordingTrackId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(0);
  const [mouseMode, setMouseMode] = useState("head"); // head | clips | delete | cut 
  const [activeKeyIds, setActiveKeyIds] = useState([]);

  // ---------- Refs ----------
  const tracksRef = useRef(tracks);
  const trackCanvasRefs = useRef({}); // { [trackId]: HTMLCanvasElement | null }
  const draggingHeadTrackIdRef = useRef(null);
  const draggingClipRef = useRef(null); // { trackId, clipId, offsetTime }

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  const {
    handleGlobalPlay,
    toggleTransportPlay,
    isTransportPlayingRef,
    isTransportPlaying,
  } = useTransport({
    tracksRef,
    setTracks,
    getViewStartTime: () => viewStartTime,
    setViewStartTime,
    getHeadTimeSeconds: () => headTimeSeconds,
    setHeadTimeSeconds,
  });


  // ---------- Helpers ----------

  const getTrackLength = (track) => {
    const zoom = track.zoom || 1;
    return BASE_STRIP_SECONDS / zoom;
  };

  const clipsOverlap = (a, b) => {
    const aStart = a.startTime;
    const aEnd = a.startTime + a.duration;
    const bStart = b.startTime;
    const bEnd = b.startTime + b.duration;
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
  };

  const willOverlap = (clips, candidate, ignoreId = null) => {
    return (clips || []).some((c) => {
      if (ignoreId && c.id === ignoreId) return false;
      return clipsOverlap(c, candidate);
    });
  };

  const syncHeadPosAllTracks = (headPos) => {
    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        headPos,
        tapeHeadPos:
          track.tapeHeadPos != null ? headPos : track.tapeHeadPos,
      }))
    );
  };

  // ---------- Public actions ----------

  const addTrack = () => {
    const id = nextTrackId;
    setTracks((prev) => [
      ...prev,
      {
        id: nextTrackId,
        name: String(id),
        zoom: globalZoom,
        headPos: 0,
        clips: [],
        hasRecording: false,
        recordingUrl: null,
        recordingDuration: 0,
        tapeHeadPos: 0,
        recordingImage: null,
        clipStartPos: 0,
        heightPx: DEFAULT_TRACK_HEIGHT_PX,
      },
    ]);
    setNextTrackId((id) => id + 1);
  };

  // change global zoom; all tracks share the same zoom
  const changeZoom = (delta) => {
    setGlobalZoom((prev) => {
      const next = Math.max(0.25, Math.min(4, prev + delta));
      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          zoom: next,
        }))
      );
      return next;
    });
  };

  // Move a clip horizontally by absolute time (seconds).
  const moveClip = (trackId, newStartTime) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;

        const nextStartTime = Math.max(
          0,
          Number.isFinite(newStartTime) ? newStartTime : 0
        );

        if (!track.clips || track.clips.length === 0) return track;

        const clip = track.clips[0];
        const candidate = { ...clip, startTime: nextStartTime };

        if (willOverlap(track.clips, candidate, clip.id)) return track;

        return {
          ...track,
          clips: track.clips.map((c) => (c.id === clip.id ? candidate : c)),
        };
      })
    );
  };


    // ---------- Mouse interaction on track strips ----------

  const handleTrackStripMouseDown = (trackId, e) => {
    setSelectedTrackId(trackId);
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1 across the strip
    frac = Math.max(0, Math.min(1, frac));

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === trackId);
    if (!track) return;

    const visibleSeconds = getTrackLength(track);
    const clickTime = visibleSeconds > 0 ? viewStartTime + frac * visibleSeconds : viewStartTime;

    const clips = track.clips || [];

    // --- DELETE MODE: delete a single clip under the cursor ---
    if (mouseMode === "delete") {
      const clickedClip = clips.find((c) => {
        const start = c.startTime;
        const end = c.startTime + c.duration;
        return clickTime >= start && clickTime <= end;
      });

      if (!clickedClip) {
        // click was in empty space -> do nothing
        return;
      }

      setTracks((prev) =>
        prev.map((t) =>
          t.id !== trackId
            ? t
            : {
                ...t,
                clips: (t.clips || []).filter((c) => c.id !== clickedClip.id),
              }
        )
      );

      // No dragging, no head movement in delete mode
      return;
    }

    // --- CUT MODE: split a clip where we clicked ---
    if (mouseMode === "cut") {
      const clickedClip = clips.find((c) => {
        const start = c.startTime;
        const end = c.startTime + c.duration;
        return clickTime >= start && clickTime <= end;
      });

      if (!clickedClip) return;

      const splitAbsTime = clickTime;
      const localSplit = splitAbsTime - clickedClip.startTime;

      // Avoid tiny slivers / accidental edge clicks
      const MIN_SLICE_SECONDS = 0.05;
      if (
        localSplit <= MIN_SLICE_SECONDS ||
        localSplit >= clickedClip.duration - MIN_SLICE_SECONDS
      ) {
        return;
      }

      const makeId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? () => crypto.randomUUID()
          : () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const baseOffset = clickedClip.offset || 0;

      const leftClip = {
        ...clickedClip,
        id: makeId(),
        duration: localSplit,
        offset: baseOffset,
      };

      const rightClip = {
        ...clickedClip,
        id: makeId(),
        startTime: splitAbsTime,
        duration: clickedClip.duration - localSplit,
        offset: baseOffset + localSplit,
      };

      setTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          const next = (t.clips || [])
            .filter((c) => c.id !== clickedClip.id)
            .concat([leftClip, rightClip])
            .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
          return { ...t, clips: next };
        })
      );

      // No dragging, no head movement in cut mode
      return;
    }

    // --- CLIP MODE: start dragging a clip if we clicked one ---
    if (mouseMode === "clip") {
      if (clips.length > 0) {
        const clickedClip = clips.find((c) => {
          const start = c.startTime;
          const end = c.startTime + c.duration;
          return clickTime >= start && clickTime <= end;
        });

        if (clickedClip) {
          const offsetTime = clickTime - clickedClip.startTime;
          draggingClipRef.current = {
            trackId,
            clipId: clickedClip.id,
            offsetTime,
          };
        }
      }

      // In clip mode we never move the head when clicking the strip
      return;
    }

    // --- HEAD MODE (default): move the tape head ---
    draggingHeadTrackIdRef.current = trackId;
    const nextHeadTime = clickTime;
    setHeadTimeSeconds(nextHeadTime);

    // Keep the stored headPos in tracks in sync with the viewport
    const pos = visibleSeconds > 0 ? (nextHeadTime - viewStartTime) / visibleSeconds : 0;
    syncHeadPosAllTracks(Math.max(0, Math.min(1, pos)));

  };



  const handleTrackStripMouseMove = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1
    frac = Math.max(0, Math.min(1, frac));

    // --- CLIP DRAGGING ---
    if (mouseMode === "clip" && draggingClipRef.current) {
      const { trackId: fromTrackId, clipId, offsetTime } =
        draggingClipRef.current;

      // Same-track drag
      if (fromTrackId === trackId) {
        setTracks((prev) =>
          prev.map((track) => {
            if (track.id !== fromTrackId) return track;

            const visibleSeconds = getTrackLength(track);
            const clickTime = visibleSeconds > 0 ? viewStartTime + frac * visibleSeconds : viewStartTime;

            const newStartTime = Math.max(0, clickTime - offsetTime);
            const clips = track.clips || [];
            const moving = clips.find((c) => c.id === clipId);
            if (!moving) return track;

            const candidate = { ...moving, startTime: newStartTime };

            // Prevent overlap on this track
            if (willOverlap(clips, candidate, clipId)) {
              // overlap -> don’t move
              return track;
            }

            const newClips = clips.map((c) =>
              c.id === clipId ? candidate : c
            );

            return {
              ...track,
              clips: newClips,
            };
          })
        );

        return;
      }

      // Cross-track drag: move clip from fromTrackId -> trackId
      setTracks((prev) => {
        // Copy tracks + clips so we can mutate safely
        const tracksCopy = prev.map((t) => ({
          ...t,
          clips: t.clips ? [...t.clips] : [],
        }));

        const fromIdx = tracksCopy.findIndex((t) => t.id === fromTrackId);
        const toIdx = tracksCopy.findIndex((t) => t.id === trackId);
        if (fromIdx === -1 || toIdx === -1) return prev;

        const fromTrack = tracksCopy[fromIdx];
        const toTrack = tracksCopy[toIdx];

        const movingClip = (fromTrack.clips || []).find(
          (c) => c.id === clipId
        );
        if (!movingClip) return prev;

        // Use the destination track's length to compute new time
        const visibleSeconds = getTrackLength(toTrack);
        const clickTime = visibleSeconds > 0 ? viewStartTime + frac * visibleSeconds : viewStartTime;

        const newStartTime = Math.max(0, clickTime - offsetTime);

        const candidate = {
          ...movingClip,
          startTime: newStartTime,
        };

        // NO OVERLAP allowed on destination track
        if (willOverlap(toTrack.clips || [], candidate, clipId)) {
          // Reject the move, keep things as they were
          return prev;
        }

        // Remove from origin
        fromTrack.clips = fromTrack.clips.filter((c) => c.id !== clipId);
        // Add to destination
        toTrack.clips = [...(toTrack.clips || []), candidate];

        return tracksCopy;
      });

      // Update drag ref to use the new track as the origin for further moves
      draggingClipRef.current = {
        trackId,
        clipId,
        offsetTime,
      };

      return;
    }

    // --- TAPE HEAD DRAGGING ---
    if (mouseMode === "head" && draggingHeadTrackIdRef.current === trackId) {
      const tracksNow = tracksRef.current || [];
      const track = tracksNow.find((t) => t.id === trackId);
      if (!track) return;

      const visibleSeconds = getTrackLength(track);
      const nextHeadTime = visibleSeconds > 0 ? viewStartTime + frac * visibleSeconds : viewStartTime;

      setHeadTimeSeconds(nextHeadTime);

      const pos = visibleSeconds > 0 ? (nextHeadTime - viewStartTime) / visibleSeconds : 0;
      syncHeadPosAllTracks(Math.max(0, Math.min(1, pos)));

    }
  };

    // Right-click delete for clips when in delete mode
  const handleTrackStripContextMenu = (trackId, e) => {
    // Only intercept right-clicks in delete mode; otherwise let the browser show its menu
    if (mouseMode !== "delete") {
      return;
    }

    e.preventDefault(); // stop the browser context menu

    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1 across the strip
    frac = Math.max(0, Math.min(1, frac));

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === trackId);
    if (!track) return;

    const visibleSeconds = getTrackLength(track);
    const clickTime = visibleSeconds > 0 ? viewStartTime + frac * visibleSeconds : viewStartTime;

    const clips = track.clips || [];

    // Find the clip under the mouse at this time
    const clickedClip = clips.find((c) => {
      const start = c.startTime;
      const end = c.startTime + c.duration;
      return clickTime >= start && clickTime <= end;
    });

    if (!clickedClip) return;

    // Delete that clip only
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: (t.clips || []).filter((c) => c.id !== clickedClip.id),
        };
      })
    );
  };


  const stopDragging = () => {
    draggingHeadTrackIdRef.current = null;
    draggingClipRef.current = null;
  };

  // Unified pointer-based mouse interactions for track strips.
  // TrackSection should use these instead of individual mouse handlers.
  const mouse_interactions = {
    onPointerDown: (trackId, e) => {
      // Always select the track you interact with
      setSelectedTrackId(trackId);

      // IMPORTANT:
      // Do NOT pointer-capture in "clip" mode, otherwise pointermove will keep firing
      // on the original track and you can’t move clips between tracks.
      if (mouseMode !== "clip") {
        try {
          e.currentTarget?.setPointerCapture?.(e.pointerId);
        } catch (_) {}
      }

      handleTrackStripMouseDown(trackId, e);
    },


    onPointerMove: (trackId, e) => {
      handleTrackStripMouseMove(trackId, e);
    },

    onPointerUp: (trackId, e) => {
      stopDragging();
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    },

    onPointerCancel: (trackId, e) => {
      stopDragging();
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    },

    onContextMenu: (trackId, e) => {
      handleTrackStripContextMenu(trackId, e);
    },
  };

  useEffect(() => {
    const handleUp = () => stopDragging();

    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mouseleave", handleUp);

    // Pointer events (more reliable with pointer-based dragging)
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mouseleave", handleUp);

      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

const drawRoundedRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};


  // ---------- TRACK DRAWING ----------
  // Draw clips + tape-heads into each track canvas whenever tracks change
  useEffect(() => {
    const refs = trackCanvasRefs.current;
    if (!refs) return;

    const tracksNow = tracksRef.current || [];

    tracksNow.forEach((track) => {
      const canvas = refs[track.id];
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width || canvas.width || 0;
      const height = rect.height || canvas.height || 56;
      if (width <= 0 || height <= 0) return;

      // Resize backing store to match CSS size * devicePixelRatio
      if (
        canvas.width !== width * dpr ||
        canvas.height !== height * dpr
      ) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear & background
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);

      const trackLength = getTrackLength(track);

// ===============================
// DRAW CLIPS (white outline)
// ===============================
if (track.clips && track.clips.length > 0) {
  const trackLength = getTrackLength(track);

  track.clips.forEach((clip) => {
    const visibleSeconds = getTrackLength(track);

    // Where the clip starts inside the current viewport (0..1 can go negative / >1)
    const startFrac =
      visibleSeconds > 0 ? (clip.startTime - viewStartTime) / visibleSeconds : 0;

    const durFrac =
      visibleSeconds > 0 ? clip.duration / visibleSeconds : 0;

    const startX = startFrac * width;
    const clipWidth = Math.max(4, durFrac * width);

    // Skip drawing if fully off-screen
    if (startX + clipWidth < 0 || startX > width) return;

    const x = startX;
    const w = clipWidth;
    const radius = 4;

    // ===== Clip height behavior =====
    // Normal clip height stays the same until the track gets too small.
    // Only then do clips shrink to fit the available track height.
    const PADDING_Y = 4;
    const availableH = Math.max(0, height - PADDING_Y * 2);

    // Keep your current "normal" look (this is the max clip height when track is tall enough)
    const MIN_CLIP_H = 8;
    const MAX_CLIP_H = 160; // cap so giant tracks don’t look ridiculous

    const clipH = Math.min(MAX_CLIP_H, Math.max(MIN_CLIP_H, availableH));


    const y = Math.round((height - clipH) / 2);
    const h = clipH;


    // --- 1) White outlined box ---
    ctx.save();
    drawRoundedRect(ctx, x, y, w, h, radius);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // --- 2) Waveform or snapshot inside box ---
    if (clip.image) {
      const img = new Image();
      img.src = clip.image;
      img.onload = () => {
        const canvasNow = trackCanvasRefs.current[track.id];
        if (!canvasNow) return;
        const ctx2 = canvasNow.getContext("2d");
        if (!ctx2) return;

        ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2.save();
        drawRoundedRect(ctx2, x, y, w, h, radius);
        ctx2.clip();

        ctx2.globalAlpha = 0.9;
        ctx2.drawImage(img, x, y, w, h);

        ctx2.restore();
      };
    } else {
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x, y, w, h, radius);
      ctx.clip();

      ctx.translate(startX, y);
      drawGenericWave(ctx, clipWidth, h, 0.9);

      ctx.restore();
    }
  });
}


      // Draw tape-head
      const visibleSeconds = getTrackLength(track);
      const headPos = visibleSeconds > 0 ? (headTimeSeconds - viewStartTime) / visibleSeconds : 0;

      // ✅ If the head is outside the current window, don't clamp it to 0/1.
      // Just don't draw it (so it doesn't "jump to the beginning").
      if (headPos >= 0 && headPos <= 1) {
        const headX = headPos * width;

        // subtle fill before the head
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, 0, headX, height);

        // yellow head line
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX, 0);
        ctx.lineTo(headX, height);
        ctx.stroke();
      }

    });
    }, [tracks, viewStartTime, headTimeSeconds, globalZoom]);


    const deleteTrack = (trackId) => {
      setTracks((prev) => {
        const next = prev.filter((t) => t.id !== trackId);
        return next.length ? next : prev; // don't allow deleting last track
      });

      // If user deleted the currently selected track, select the first remaining track
      setSelectedTrackId((prevSelected) => {
        if (prevSelected !== trackId) return prevSelected;
        const remaining = tracksRef.current?.filter((t) => t.id !== trackId) || [];
        return remaining[0]?.id ?? null;
      });
    };

    const renameTrack = (trackId, nextName) => {
      const cleaned = (nextName ?? "").trim();
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, name: cleaned } : t))
      );
    };

    const setTrackHeightPx = (trackId, heightPx) => {
      const h = Math.max(MIN_TRACK_HEIGHT_PX, Math.min(MAX_TRACK_HEIGHT_PX, Math.round(heightPx)));
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, heightPx: h } : t))
      );
    };

  // ---------- Return API ----------
  return {
    // state
    tracks,
    setTracks,
    nextTrackId,
    setNextTrackId,
    viewStartTime,
    setViewStartTime,
    headTimeSeconds,
    setHeadTimeSeconds,

    globalZoom,
    setGlobalZoom,
    activeRecordingTrackId,
    setActiveRecordingTrackId,
    selectedTrackId,
    setSelectedTrackId,
    mouseMode,
    setMouseMode,
    activeKeyIds,
    setActiveKeyIds,

    // refs
    trackCanvasRefs,
    tracksRef,

    // helpers
    getTrackLength,

    // actions
    addTrack,
    deleteTrack,
    renameTrack,
    setTrackHeightPx,
    DEFAULT_TRACK_HEIGHT_PX,
    MIN_TRACK_HEIGHT_PX,
    MAX_TRACK_HEIGHT_PX,

    changeZoom,
    moveClip,
    handleTrackStripMouseDown,
    handleTrackStripMouseMove,
    handleTrackStripContextMenu,
    stopDragging,
    mouse_interactions,

    handleGlobalPlay,
    toggleTransportPlay,
    isTransportPlayingRef,
    isTransportPlaying,
  };
}
