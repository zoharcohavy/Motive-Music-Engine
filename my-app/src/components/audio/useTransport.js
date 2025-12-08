// src/components/audio/useTransport.js
import { useRef, useEffect, useCallback } from "react";

// Keep this in sync with TrackSection's BASE_STRIP_SECONDS
const BASE_STRIP_SECONDS = 10;

/**
 * Transport hook for a global tape head that plays clips
 * on ALL tracks at once.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.tracksRef - ref to the latest tracks array
 * @param {Function} params.setTracks - React setState for tracks
 */
export function useTransport({ tracksRef, setTracks }) {
  const isTransportPlayingRef = useRef(false);
  const transportAnimationFrameRef = useRef(null);
  const transportStartWallTimeRef = useRef(null);
  const transportStartHeadTimeRef = useRef(0);
  const transportActiveClipsRef = useRef(new Map()); // key: `${trackId}:${clipId}` -> HTMLAudioElement

  // ---- Helpers -------------------------------------------------------------

  const stopAllTransportAudio = useCallback(() => {
    const map = transportActiveClipsRef.current;
    if (!map) return;

    for (const audio of map.values()) {
      try {
        audio.pause();
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
    const stripSeconds = BASE_STRIP_SECONDS / zoomNow;

    // Get current head position from the first track (they should all be in sync)
    const currentHeadPos =
      tracksNow[0].headPos != null
        ? tracksNow[0].headPos
        : tracksNow[0].tapeHeadPos || 0;

    const startHeadTime = stripSeconds * currentHeadPos;

    isTransportPlayingRef.current = true;
    transportStartWallTimeRef.current = performance.now();
    transportStartHeadTimeRef.current = startHeadTime;

    // Ensure all tracks share the same initial headPos / tapeHeadPos
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        headPos: currentHeadPos,
        tapeHeadPos: currentHeadPos,
      }))
    );

    const step = () => {
      if (!isTransportPlayingRef.current) {
        return;
      }

      const tracksInner = tracksRef.current || [];
      if (!tracksInner.length) {
        isTransportPlayingRef.current = false;
        stopAllTransportAudio();
        return;
      }

      const zoomInner = (tracksInner[0] && tracksInner[0].zoom) || 1;
      const stripSecondsInner = BASE_STRIP_SECONDS / zoomInner;

      const now = performance.now();
      const elapsed = (now - transportStartWallTimeRef.current) / 1000;
      const startTime = transportStartHeadTimeRef.current;

      let headTime = startTime + elapsed;
      let reachedEnd = false;

      if (stripSecondsInner > 0 && headTime >= stripSecondsInner) {
        headTime = stripSecondsInner;
        reachedEnd = true;
      } else if (headTime < 0) {
        headTime = 0;
      }

      const newHeadPos =
        stripSecondsInner > 0 ? headTime / stripSecondsInner : 0;

      // Move the tape head on *all* tracks so UI stays in sync
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          headPos: newHeadPos,
          tapeHeadPos: newHeadPos,
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
              // New active clip at this headTime
              const audio = new Audio(clip.url);
              const offset = Math.max(0, headTime - clipStart);

              const startAudioAtOffset = () => {
                try {
                  const dur = audio.duration || clip.duration || 0;
                  const offsetFrac = dur > 0 ? offset / dur : 0;
                  audio.currentTime = offsetFrac * dur;
                } catch (e) {
                  // ignore
                }
                audio.play().catch(() => {});
              };

              if (audio.readyState >= 1) {
                startAudioAtOffset();
              } else {
                audio.addEventListener("loadedmetadata", startAudioAtOffset, {
                  once: true,
                });
              }

              activeMap.set(key, audio);
            }
          }
        }
      }

      // Stop clips that are no longer under the head
      for (const [key, audio] of activeMap.entries()) {
        if (!shouldBeActive.has(key)) {
          try {
            audio.pause();
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
  }, [tracksRef, setTracks, stopAllTransportAudio]);

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
  };
}
