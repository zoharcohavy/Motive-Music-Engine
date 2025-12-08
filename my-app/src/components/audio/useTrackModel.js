// useTrackModel.js
import { useRef, useState, useEffect } from "react";
import { drawGenericWave } from "./drawUtils";
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
export function useTrackModel({ BASE_STRIP_SECONDS }) {
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

  
  const [nextTrackId, setNextTrackId] = useState(1);
  const [globalZoom, setGlobalZoom] = useState(1);
  const [activeRecordingTrackId, setActiveRecordingTrackId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(0);
  const [mouseMode, setMouseMode] = useState("head"); // "head" | "clip"
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
  } = useTransport({ tracksRef, setTracks });

  // ---------- Helpers ----------

  const getStripSeconds = (track) => {
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
    setTracks((prev) => [
      ...prev,
      {
        id: nextTrackId,
        zoom: globalZoom,
        headPos: 0,
        clips: [],
        hasRecording: false,
        recordingUrl: null,
        recordingDuration: 0,
        tapeHeadPos: 0,
        recordingImage: null,
        clipStartPos: 0,
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

  // Move a clip horizontally by some fraction (used by older code; still kept)
  const moveTrackRecording = (trackId, newStartFrac) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const stripSeconds = getStripSeconds(track);
        const newStartTime = stripSeconds > 0 ? newStartFrac * stripSeconds : 0;

        if (!track.clips || track.clips.length === 0) {
          return track;
        }

        const clip = track.clips[0];
        const candidate = {
          ...clip,
          startTime: Math.max(0, newStartTime),
        };

        if (willOverlap(track.clips, candidate, clip.id)) {
          return track;
        }

        return {
          ...track,
          clips: track.clips.map((c) =>
            c.id === clip.id ? candidate : c
          ),
        };
      })
    );
  };

  // ---------- Mouse interaction on track strips ----------

  const handleTrackStripMouseDown = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1 across the strip
    frac = Math.max(0, Math.min(1, frac));

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === trackId);
    if (!track) return;

    const stripSeconds = getStripSeconds(track);
    const clickTime = stripSeconds > 0 ? frac * stripSeconds : 0;
    const clips = track.clips || [];

    // If we're in "clip" mode, see if we clicked on a clip and start dragging it
    if (mouseMode === "clip" && clips.length > 0) {
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
        return;
      }
    }

    // Otherwise, we’re moving the tape-head
    draggingHeadTrackIdRef.current = trackId;
    syncHeadPosAllTracks(frac);
  };

  const handleTrackStripMouseMove = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1
    frac = Math.max(0, Math.min(1, frac));

    // If a clip is being dragged, move that clip
    if (draggingClipRef.current) {
      const { trackId: fromTrackId, clipId, offsetTime } =
        draggingClipRef.current;

      setTracks((prev) =>
        prev.map((track) => {
          if (track.id !== fromTrackId) return track;

          const stripSeconds = getStripSeconds(track);
          const clickTime =
            stripSeconds > 0 ? frac * stripSeconds : 0;

          const newStartTime = Math.max(0, clickTime - offsetTime);
          const clips = track.clips || [];
          const moving = clips.find((c) => c.id === clipId);
          if (!moving) return track;

          const candidate = { ...moving, startTime: newStartTime };

          if (willOverlap(clips, candidate, clipId)) {
            // overlap -> don’t move
            return track;
          }

          const newClips = clips.map((c) =>
            c.id === clipId ? candidate : c
          );
          return { ...track, clips: newClips };
        })
      );

      return;
    }

    // If tape-head is being dragged on this track, sync headPos
    if (draggingHeadTrackIdRef.current === trackId) {
      syncHeadPosAllTracks(frac);
    }
  };

  const stopDragging = () => {
    draggingHeadTrackIdRef.current = null;
    draggingClipRef.current = null;
  };

  useEffect(() => {
    const handleUp = () => stopDragging();
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mouseleave", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mouseleave", handleUp);
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

      const stripSeconds = getStripSeconds(track);

// ===============================
// DRAW CLIPS (white outline)
// ===============================
if (track.clips && track.clips.length > 0) {
  const stripSeconds = getStripSeconds(track);

  track.clips.forEach((clip) => {
    const startFrac =
      stripSeconds > 0 ? clip.startTime / stripSeconds : 0;
    const durFrac =
      stripSeconds > 0 ? clip.duration / stripSeconds : 0;

    const startX = startFrac * width;
    const clipWidth = Math.max(4, durFrac * width);

    const x = startX;
    const y = 4;
    const w = clipWidth;
    const h = height - 8;
    const radius = 4;

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

      ctx.translate(startX, 0);
      drawGenericWave(ctx, clipWidth, height, 0.9);

      ctx.restore();
    }
  });
}


      // Draw tape-head
      const headPos =
        track.headPos != null
          ? track.headPos
          : track.tapeHeadPos || 0;
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
    });
  }, [tracks, BASE_STRIP_SECONDS]);

  // ---------- Return API ----------
  return {
    // state
    tracks,
    setTracks,
    nextTrackId,
    setNextTrackId,
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
    getStripSeconds,

    // actions
    addTrack,
    changeZoom,
    moveTrackRecording,
    handleTrackStripMouseDown,
    handleTrackStripMouseMove,
    stopDragging,

    handleGlobalPlay,
    toggleTransportPlay,
    isTransportPlayingRef,
  };
}
