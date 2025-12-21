// src/components/audio/useTransport.js
import { useRef, useEffect, useCallback, useState } from "react";

// Keep this in sync with TrackSection's BASE_STRIP_SECONDS
const BASE_STRIP_SECONDS = 10;
// Keep timeline playable/recordable even when there are no clips yet
const MIN_TIMELINE_SECONDS = 120;

const TIMELINE_CHUNK_SECONDS = 120; // 2 minutes
const TIMELINE_GROW_BUFFER = 10;    // last 10 seconds triggers growth

const getDynamicTimelineEndSeconds = (tracks, headTimeSeconds) => {
  const baseEnd = getTimelineEndSeconds(tracks); // at least 120
  const head = Math.max(0, Number(headTimeSeconds) || 0);

  const snappedEnd =
    Math.max(TIMELINE_CHUNK_SECONDS, Math.ceil(Math.max(baseEnd, head) / TIMELINE_CHUNK_SECONDS) * TIMELINE_CHUNK_SECONDS);

  return head >= snappedEnd - TIMELINE_GROW_BUFFER
    ? snappedEnd + TIMELINE_CHUNK_SECONDS
    : snappedEnd;
};

const getTimelineEndSeconds = (tracks) => {
  let end = 0;
  for (const t of tracks || []) {
    for (const c of t.clips || []) {
      const clipEnd = (c.startTime || 0) + (c.duration || 0);
      if (clipEnd > end) end = clipEnd;
    }
  }
  return Math.max(end, MIN_TIMELINE_SECONDS);
};

/**
 * Transport hook for a global tape head that plays clips
 * on ALL tracks at once.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.tracksRef - ref to the latest tracks array
 * @param {Function} params.setTracks - React setState for tracks
 */
export function useTransport({
  tracksRef,
  setTracks,
  getViewStartTime,
  setViewStartTime,
  getHeadTimeSeconds,
  setHeadTimeSeconds,
  playClipUrl,
}) {
  const isTransportPlayingRef = useRef(false);
  const [isTransportPlaying, setIsTransportPlaying] = useState(false);

  const transportAnimationFrameRef = useRef(null);
  const transportStartWallTimeRef = useRef(null);
  const transportStartHeadTimeRef = useRef(0);
  const transportActiveClipsRef = useRef(new Map()); // key: `${trackId}:${clipId}` -> HTMLAudioElement
  const lastAutoScrollAtRef = useRef(0);
  const viewStartRef = useRef(0);


  // ---- Helpers -------------------------------------------------------------
  const stopAllTransportAudio = useCallback(() => {
    const map = transportActiveClipsRef.current;
    if (!map) return;

    for (const v of map.values()) {
      try {
        if (v && typeof v.stop === "function") {
          v.stop(); // WebAudio handle
        } else if (v && typeof v.pause === "function") {
          v.pause(); // HTMLAudioElement fallback
        }
      } catch (e) {
        // ignore
      }
    }

    transportActiveClipsRef.current = new Map();
  }, []);


  // ---- Main toggle --------------------------------------------------------

  const toggleTransportPlay = useCallback(() => {
    // If already playing, stop transport + audio
    if (isTransportPlayingRef.current) {
      isTransportPlayingRef.current = false;
      setIsTransportPlaying(false);

      if (transportAnimationFrameRef.current) {
        cancelAnimationFrame(transportAnimationFrameRef.current);
        transportAnimationFrameRef.current = null;
      }

      stopAllTransportAudio();
      return;
    }


    const tracksNow = tracksRef.current || [];
    if (!tracksNow.length) return;

    // Use the zoom of the first track as the global zoom
    const zoomNow = (tracksNow[0] && tracksNow[0].zoom) || 1;
    const trackLength = BASE_STRIP_SECONDS / zoomNow;

    // Get current head position from the first track (they should all be in sync)
    // IMPORTANT: headPos is clamped to the visible window and is NOT a reliable absolute time.
    // Always start from absolute headTimeSeconds if available.
    // If it's missing, derive absolute time as viewStart + headPos * trackLength.
    const currentHeadPos =
      tracksNow[0].headPos != null ? tracksNow[0].headPos : tracksNow[0].tapeHeadPos || 0;

    const viewStartNow =
      typeof getViewStartTime === "function" ? (getViewStartTime() || 0) : 0;
    viewStartRef.current = viewStartNow;
    lastAutoScrollAtRef.current = viewStartNow;


    let startHeadTime =
      typeof getHeadTimeSeconds === "function" ? (getHeadTimeSeconds() ?? null) : null;

    if (!Number.isFinite(startHeadTime)) {
      startHeadTime = viewStartNow + trackLength * currentHeadPos;
    }


    isTransportPlayingRef.current = true;
    setIsTransportPlaying(true);
    transportStartWallTimeRef.current = performance.now();

    transportStartHeadTimeRef.current = startHeadTime;
    


    // Ensure all tracks share the same initial headPos / tapeHeadPos

    const step = () => {
      if (!isTransportPlayingRef.current) {
        return;
      }

      const tracksInner = tracksRef.current || [];
      if (!tracksInner.length) {
        isTransportPlayingRef.current = false;
        setIsTransportPlaying(false);
        stopAllTransportAudio();
        return;
      }


      const zoomInner = (tracksInner[0] && tracksInner[0].zoom) || 1;
      const trackLengthInner = BASE_STRIP_SECONDS / zoomInner;

      const now = performance.now();
      const elapsed = (now - transportStartWallTimeRef.current) / 1000;
      const startTime = transportStartHeadTimeRef.current;

      let headTime = startTime + elapsed;
      let reachedEnd = false;

      // ✅ Clamp to the *timeline end*, not the visible strip length
      const timelineEnd = getDynamicTimelineEndSeconds(tracksInner, headTime);

      if (headTime >= timelineEnd) {
        headTime = timelineEnd;
        reachedEnd = true;
      } else if (headTime < 0) {
        headTime = 0;
      }

      if (reachedEnd) {
        isTransportPlayingRef.current = false;
        setIsTransportPlaying(false);
        stopAllTransportAudio();
        return;
      }



      if (typeof setHeadTimeSeconds === "function") {
        setHeadTimeSeconds(headTime);
      }

      let viewStart = viewStartRef.current || 0;

      // Auto-scroll:
      // - If the head is slightly past the right edge during playback, shift by half a window (normal DAW feel).
      // - If the head is FAR offscreen (left or right), jump directly to it in ONE shot.
      if (typeof setViewStartTime === "function" && trackLengthInner > 0) {
        // Put head around 30% into view when we need to jump to it
        const jumpPadding = trackLengthInner * 0.30;
        const viewEnd = viewStart + trackLengthInner;
        const pageShift = trackLengthInner * 0.60;

        let nextViewStart = null;

        // If head is far offscreen LEFT: one-shot jump
        if (headTime < viewStart) {
          nextViewStart = Math.max(0, headTime - jumpPadding);
        }

        // If head is offscreen RIGHT (or past our follow threshold):
        // shift the view by a chunk so the head jumps back left and can visibly move again.
        if (headTime > viewEnd) {
          // If it's WAY off to the right, jump directly to it.
          const viewEnd = viewStart + trackLengthInner;
          const overshoot = headTime - viewEnd;

          if (overshoot > trackLengthInner * 0.5) {
            nextViewStart = Math.max(0, headTime - jumpPadding);
          } else {
            nextViewStart = Math.max(0, viewStart + pageShift);
          }
        }

        if (nextViewStart != null) {
          if (Math.abs(nextViewStart - lastAutoScrollAtRef.current) > 0.001) {
            lastAutoScrollAtRef.current = nextViewStart;

            // ✅ update immediately so the animation loop doesn't "chase" stale state
            viewStartRef.current = nextViewStart;

            setViewStartTime(nextViewStart);
          }
          viewStart = nextViewStart;
        }
      }



      const newHeadPos = trackLengthInner > 0 ? (headTime - viewStart) / trackLengthInner : 0;

      const clampedHeadPos = Math.max(0, Math.min(1, newHeadPos));

      // Move the tape head on *all* tracks so UI stays in sync
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          headPos: clampedHeadPos,
          tapeHeadPos: clampedHeadPos,

        }))
      );

      // Determine which clips should be active at this headTime
      const shouldBeActive = new Set();
      const activeMap = new Map(transportActiveClipsRef.current);

      for (const track of tracksInner) {
        const clips = track.clips || [];
        for (const clip of clips) {
          if (!clip || clip.startTime == null || clip.duration == null) continue;

          const clipStart = clip.startTime;
          const clipEnd = clip.startTime + clip.duration;

          if (headTime >= clipStart && headTime <= clipEnd) {
            const key = `${track.id}:${clip.id}`;
            shouldBeActive.add(key);
            if (!activeMap.has(key)) {
              // New active clip at this headTime (prefer WebAudio so per-track FX applies)
              const withinClip = Math.max(0, headTime - clipStart);
              const desiredTime = (clip.offset || 0) + withinClip;

              if (typeof playClipUrl === "function") {
                // WebAudio handle (supports FX)
                Promise.resolve(
                  playClipUrl(clip.url, {
                    offsetSeconds: desiredTime,
                    effectsOverride: track.effects || [],
                    gain: 1,
                  })
                ).then((handle) => {
                  if (handle) activeMap.set(key, handle);
                });
              } else {
                // Fallback: HTMLAudio (no FX)
                const audio = new Audio(clip.url);
                const startAudioAtOffset = () => {
                  try {
                    const dur = audio.duration || 0;
                    if (dur > 0) {
                      audio.currentTime = Math.min(desiredTime, Math.max(0, dur - 0.01));
                    }
                  } catch (e) {
                    // ignore
                  }
                  audio.play().catch(() => {});
                };

                if (audio.readyState >= 1) startAudioAtOffset();
                else {
                  audio.addEventListener("loadedmetadata", startAudioAtOffset, { once: true });
                }

                activeMap.set(key, audio);
              }
            }

          
          }
        }
      }

      // Stop clips that are no longer under the head
      for (const [key, handle] of activeMap.entries()) {
        if (!shouldBeActive.has(key)) {
          try {
            if (handle && typeof handle.stop === "function") {
              handle.stop(); // WebAudio handle
            } else if (handle && typeof handle.pause === "function") {
              handle.pause(); // HTMLAudio fallback
            }
          } catch (e) {
            // ignore
          }
          activeMap.delete(key);
        }
      }


      transportActiveClipsRef.current = activeMap;

      if (reachedEnd) {
        isTransportPlayingRef.current = false;
        stopAllTransportAudio();
        if (transportAnimationFrameRef.current) {
          cancelAnimationFrame(transportAnimationFrameRef.current);
          transportAnimationFrameRef.current = null;
        }
        return;
      }

      transportAnimationFrameRef.current = requestAnimationFrame(step);
    };

  transportAnimationFrameRef.current = requestAnimationFrame(step);
  }, [
  tracksRef,
  setTracks,
  stopAllTransportAudio,
  getViewStartTime,
  setViewStartTime,
  getHeadTimeSeconds,
  setHeadTimeSeconds,
]);


  // Simple wrapper for UI / Space bar
  const handleGlobalPlay = useCallback(() => {
    toggleTransportPlay();
  }, [toggleTransportPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isTransportPlayingRef.current = false;
      if (transportAnimationFrameRef.current) {
        cancelAnimationFrame(transportAnimationFrameRef.current);
        transportAnimationFrameRef.current = null;
      }
      stopAllTransportAudio();
    };
  }, [stopAllTransportAudio]);

  return {
    handleGlobalPlay,
    toggleTransportPlay,
    isTransportPlayingRef,
    isTransportPlaying,
  };
}
