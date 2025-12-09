// src/components/audio/useRecording.js
import { useRef, useState, useEffect } from "react";
import { API_BASE } from "./constants";

/**
 * Hook responsible for server-backed recording logic:
 * - sets up a MediaRecorder wired to the master gain
 * - manages track/room recordings
 * - uploads finished recordings and refreshes the recordings list
 * - animates the tape head while recording
 */
export function useRecording({
  audioEngine,
  trackCanvasRefs,
  tracksRef,
  setTracks,
  activeRecordingTrackId,
  setActiveRecordingTrackId,
} = {}) {
  if (!audioEngine) {
    throw new Error(
      "useRecording: audioEngine is undefined. Pass the object returned by useAudioEngine as the audioEngine option."
    );
  }

  const {
    getAudioContext,
    masterGainRef,
    recordDestRef,
    mediaRecorderRef,
    recordingChunksRef,
  } = audioEngine;


  // UI state
  const [recordings, setRecordings] = useState([]);
  const [recordingsError, setRecordingsError] = useState(null);
  const [isRoomRecording, setIsRoomRecording] = useState(false);

  // Internal refs for recording session
  const recordingTargetTrackIdRef = useRef(null);
  const recordStartTimeRef = useRef(null);
  const recordDurationRef = useRef(0);
  const recordInitialHeadPosRef = useRef(0);

  const activeRecordingTrackIdRef = useRef(activeRecordingTrackId);
  useEffect(() => {
    activeRecordingTrackIdRef.current = activeRecordingTrackId;
  }, [activeRecordingTrackId]);

  const BASE_STRIP_SECONDS = 10;

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

  // ----- recordings list from server -----
  const fetchRecordings = async () => {
    try {
      setRecordingsError(null);
      const res = await fetch(`${API_BASE}/api/recordings`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRecordings(data.recordings || data);
    } catch (err) {
      console.error("Failed to fetch recordings:", err);
      setRecordingsError(err.message || "Unknown error");
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  // ----- create MediaRecorder when audio engine is ready -----
  useEffect(() => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain || mediaRecorderRef.current) return;

    const recordDest = ctx.createMediaStreamDestination();
    masterGain.connect(recordDest);

    const mediaRecorder = new MediaRecorder(recordDest.stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordingChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordingChunksRef.current, { type: "audio/wav" });
      recordingChunksRef.current = [];

      const targetTrackId = recordingTargetTrackIdRef.current;
      recordingTargetTrackIdRef.current = null;
      setActiveRecordingTrackId(null);

      const localUrl = URL.createObjectURL(blob);

      if (recordStartTimeRef.current) {
        recordDurationRef.current =
          (performance.now() - recordStartTimeRef.current) / 1000;
      }

      let recordingImage = null;
      if (
        targetTrackId != null &&
        trackCanvasRefs.current &&
        trackCanvasRefs.current[targetTrackId]
      ) {
        try {
          recordingImage =
            trackCanvasRefs.current[targetTrackId].toDataURL("image/png");
        } catch (e) {
          console.warn("Could not snapshot tape canvas", e);
        }
      }

      if (targetTrackId != null) {
        const duration = recordDurationRef.current || 0;

        setTracks((prev) =>
          prev.map((track) => {
            if (track.id !== targetTrackId) return track;

            const stripSeconds = getStripSeconds(track);
            const clipStartFrac = recordInitialHeadPosRef.current || 0; // 0..1
            const clipStartTime = clipStartFrac * stripSeconds;

            const newClip = {
              id: crypto.randomUUID(),
              url: localUrl,
              duration,
              startTime: clipStartTime,
              startFrac: clipStartFrac,
              image: recordingImage,
            };

            const existing = track.clips || [];

            // Don't allow overlapping clips
            if (willOverlap(existing, newClip)) {
              return track;
            }

            const updatedClips = [...existing, newClip];

            // Move head to the end of this new clip (0..1 across strip)
            const stripEndTime = clipStartTime + duration;
            const clampedEnd = Math.min(stripSeconds, stripEndTime);
            const headPos =
              stripSeconds > 0 ? clampedEnd / stripSeconds : 0;

            return {
              ...track,
              clips: updatedClips,
              headPos,

              // keep legacy fields for anything still using them
              hasRecording: true,
              recordingUrl: localUrl,
              recordingDuration: duration,
              tapeHeadPos: headPos,
              clipStartPos: clipStartFrac,
              recordingImage,
            };
          })
        );
      }

      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.wav");

        await fetch(`${API_BASE}/api/recordings/upload`, {
          method: "POST",
          body: formData,
        });

        fetchRecordings();
      } catch (err) {
        console.error("Upload failed:", err);
      }
    };

    recordDestRef.current = recordDest;
    mediaRecorderRef.current = mediaRecorder;
  }, [
    getAudioContext,
    masterGainRef,
    mediaRecorderRef,
    recordDestRef,
    recordingChunksRef,
    trackCanvasRefs,
    setTracks,
    setActiveRecordingTrackId,
  ]);

  // ----- animate tape head while recording -----
  useEffect(() => {
    let frameId = null;

    const step = () => {
      const recorder = mediaRecorderRef.current;
      const isRecording = recorder && recorder.state === "recording";
      const targetTrackId = recordingTargetTrackIdRef.current;

      if (
        isRecording &&
        targetTrackId != null &&
        recordStartTimeRef.current != null
      ) {
        const now = performance.now();
        const elapsedSec = (now - recordStartTimeRef.current) / 1000;
        recordDurationRef.current = elapsedSec;

        const tracksNow = tracksRef.current || [];
        const track = tracksNow.find((t) => t.id === targetTrackId);

        if (track) {
          const stripSeconds = getStripSeconds(track);
          const startFrac = recordInitialHeadPosRef.current || 0;

          let headPos = startFrac;
          if (stripSeconds > 0) {
            headPos = startFrac + elapsedSec / stripSeconds;
          }

          if (headPos >= 1) {
            headPos = 1;
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }

          const stripTime = headPos * stripSeconds;
          const existingClips = track.clips || [];
          const collided = existingClips.find((c) => {
            const start = c.startTime;
            const end = c.startTime + c.duration;
            return stripTime >= start && stripTime <= end;
          });

          if (collided && recorder.state === "recording") {
            recorder.stop();
          }

          setTracks((prev) =>
            prev.map((t) =>
              t.id === targetTrackId ? { ...t, headPos } : t
            )
          );
        }
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [mediaRecorderRef, tracksRef, setTracks]);

  // ----- recording controls -----
  const handleTrackRecordToggle = (trackId) => {
    const ctx = getAudioContext();
    if (!ctx || !mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;

    // If currently recording, stop
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }

    // Otherwise start recording on this track
    recordingTargetTrackIdRef.current = trackId;
    setActiveRecordingTrackId(trackId);

    recordStartTimeRef.current = performance.now();

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === trackId);
    const headPos =
      track && (track.headPos != null ? track.headPos : track.tapeHeadPos || 0);
    recordInitialHeadPosRef.current = headPos || 0;

    recorder.start();
  };

  const handleRoomRecordToggle = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording" && isRoomRecording) {
      recorder.stop();
      setIsRoomRecording(false);
      return;
    }

    if (recorder.state === "recording" && !isRoomRecording) {
      console.warn("Already recording a track; stop that first.");
      return;
    }

    // Start a new "room" recording: no specific track target
    recordingTargetTrackIdRef.current = null;
    recordStartTimeRef.current = performance.now();
    recorder.start();
    setIsRoomRecording(true);
  };

  return {
    recordings,
    recordingsError,
    isRoomRecording,
    handleTrackRecordToggle,
    handleRoomRecordToggle,
  };
}
