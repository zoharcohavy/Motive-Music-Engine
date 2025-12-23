// src/components/audio/useRecording.js
import { useRef, useState, useEffect } from "react";
import { API_BASE } from "../constants";

/**
 * Hook responsible for server-backed recording logic:
 * - sets up a MediaRecorder wired to the master gain
 * - manages track/room recordings
 * - uploads finished recordings and refreshes the recordings list
 * - animates the tape head while recording
 */
export function useRecording({
  audioEngine,
  getHeadTimeSeconds,
  setViewStartTime,
  trackCanvasRefs,
  tracksRef,
  setTracks,
  setHeadTimeSeconds,
  getViewStartTime,
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
  const [storageFiles, setStorageFiles] = useState([]);
  const [storageError, setStorageError] = useState(null);

  const [isRoomRecording, setIsRoomRecording] = useState(false);
  const [isGlobalRecording, setIsGlobalRecording] = useState(false);

  // Internal refs for recording session
  const recordingTargetTrackIdsRef = useRef([]);
  const trackRecordersRef = useRef(new Map()); // trackId -> { recorder, chunks: [] }
  const recordStartTimeRef = useRef(null);
  const recordDurationRef = useRef(0);
  const recordInitialHeadPosRef = useRef(0);
  const recordInitialHeadTimeSecondsRef = useRef(0);
  const lastViewStartDuringRecordRef = useRef(0);


  const BASE_STRIP_SECONDS = 10;

  const tempRecClipIdFor = (trackId) => `__REC_LIVE__${trackId}`;

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

  const fetchStorage = async () => {
    try {
      setStorageError(null);

      const res = await fetch(`${API_BASE}/api/storage`);

      // If the backend doesn't support storage yet, treat it like "no files"
      if (res.status === 404) {
        setStorageFiles([]);
        setStorageError(null);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setStorageFiles(Array.isArray(data.storage) ? data.storage : []);
    } catch (err) {
      setStorageFiles([]);
      // Only show a real error if it's not a missing route
      setStorageError(err?.message || String(err));
    }
  };


  const uploadStorageFile = async (file) => {
    if (!file) throw new Error("No file provided");

    const formData = new FormData();
    formData.append("clip", file); // must match server field name

    const res = await fetch(`${API_BASE}/api/storage/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      const cleanMessage =
        text.includes("Cannot POST")
          ? "Upload route not found on backend (POST /api/storage/upload). Check API_BASE and server routes."
          : text || `Upload failed (HTTP ${res.status})`;

      throw new Error(cleanMessage);
    }

    const data = await res.json(); // { filename }
    fetchStorage(); // refresh library list
    return data;
  };

  useEffect(() => {
    fetchRecordings();
    fetchStorage();
  }, []);

  // ----- create MediaRecorder when audio engine is ready -----
 
  // ----- animate tape head while recording -----
  useEffect(() => {
    let frameId = null;

    const step = () => {
      const recorder = mediaRecorderRef.current;

      // Consider ANY active recorder (room OR armed-track recording)
      const anyTrackRecorderRecording = (() => {
        const map = trackRecordersRef.current;
        if (!map || map.size === 0) return false;
        for (const { recorder: r } of map.values()) {
          if (r && r.state === "recording") return true;
        }
        return false;
      })();

      const isRecording =
        (recorder && recorder.state === "recording") ||
        anyTrackRecorderRecording ||
        isGlobalRecording;

      if (isRecording && recordStartTimeRef.current != null) {
        const now = performance.now();
        const elapsedSec = (now - recordStartTimeRef.current) / 1000;
        recordDurationRef.current = elapsedSec;

        const tracksNow = tracksRef.current || [];
        if (!tracksNow.length) {
          frameId = window.requestAnimationFrame(step);
          return;
        }

        // Absolute head time = (absolute start time when record began) + elapsed
        const headTimeAbs =
          (recordInitialHeadTimeSecondsRef.current || 0) + elapsedSec;

        // This is what your canvases actually use to draw the yellow tapehead
        if (typeof setHeadTimeSeconds === "function") {
          setHeadTimeSeconds(headTimeAbs);
        }

        // Use first track as the reference for viewport length (all tracks share the same viewStart)
        const refTrack = tracksNow[0];
        const trackLength = getTrackLength(refTrack);

        // Current viewport start
        let viewStart =
          typeof getViewStartTime === "function" ? getViewStartTime() || 0 : 0;

        // Auto-scroll while recording: when head reaches right edge, move window forward by half
        if (
          typeof setViewStartTime === "function" &&
          trackLength > 0 &&
          headTimeAbs >= viewStart + trackLength
        ) {
          const nextViewStart = headTimeAbs - trackLength / 2;
          lastViewStartDuringRecordRef.current = nextViewStart;
          setViewStartTime(nextViewStart);
          viewStart = nextViewStart;
        }

        // Update headPos for ALL tracks so the yellow head animates everywhere
        setTracks((prev) =>
          (prev || []).map((t) => {
            const len = getTrackLength(t);
            if (!len) return t;
            const frac = (headTimeAbs - viewStart) / len;
            const headPos = Math.max(0, Math.min(1, frac));
            return { ...t, headPos };
          })
        );
        const startTime = recordInitialHeadTimeSecondsRef.current || 0;
        const duration = Math.max(0, recordDurationRef.current || 0);

        // Which tracks are being recorded (armed tracks from start)
        const targetIds = new Set(recordingTargetTrackIdsRef.current || []);

        if (targetIds.size > 0) {
          setTracks((prev) =>
            (prev || []).map((t) => {
              const tempId = tempRecClipIdFor(t.id);

              // Remove temp clip from non-target tracks
              if (!targetIds.has(t.id)) {
                const cleaned = (t.clips || []).filter((c) => c.id !== tempId);
                return cleaned.length === (t.clips || []).length ? t : { ...t, clips: cleaned };
              }

              // Add/update temp clip on target track
              const clips = Array.isArray(t.clips) ? t.clips : [];
              const tempClip = {
                id: tempId,
                startTime,
                duration,
                url: null,
                image: null,
                isTemp: true,
              };

              const idx = clips.findIndex((c) => c.id === tempId);
              if (idx >= 0) {
                const next = clips.slice();
                next[idx] = tempClip;
                return { ...t, clips: next };
              }
              return { ...t, clips: [...clips, tempClip] };
            })
          );
        }
      }
      // Live “growing” clip while recording
      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
  mediaRecorderRef,
  tracksRef,
  setTracks,
  getViewStartTime,
  setViewStartTime,
  setHeadTimeSeconds,
]);

  const ensureMediaRecorder = () => {
    if (mediaRecorderRef.current) return;

    const dest = recordDestRef.current;
    if (!dest?.stream) return;

    const recorder = new MediaRecorder(dest.stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordingChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      // your existing onstop logic (upload + add clip to tracks)
      // (do NOT put "..." here either)
    };
  };
  // NEW: Global record toggle.
  // - Start: records the master output
  // - Stop: uploads + drops the recorded clip onto ALL tracks with isRecEnabled === true
   const toggleGlobalRecord = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // STOP
    if (isGlobalRecording) {
      const map = trackRecordersRef.current;

      for (const { recorder } of map.values()) {
        try {
          if (recorder?.state === "recording") recorder.stop();
        } catch (e) {}
      }

      setIsGlobalRecording(false);

      // IMPORTANT: do NOT remove the temp clip here.
      // Let recorder.onstop replace the temp clip with the final clip.
      // (So the growing clip never disappears.)

      // Reset these AFTER stop has been requested (ok to clear targets;
      // onstop uses t.id directly and tempRecClipIdFor(t.id))
      recordingTargetTrackIdsRef.current = [];
      recordStartTimeRef.current = null;

      return;
    }



    // START: record ONLY armed tracks
    const tracksNow = tracksRef.current || [];
    const armedTracks = tracksNow.filter((t) => t.isRecEnabled === true);
    if (!armedTracks.length) return;
    recordingTargetTrackIdsRef.current = armedTracks.map((t) => t.id);


    // Prepare tapehead animation baseline
    recordStartTimeRef.current = performance.now();
    recordDurationRef.current = 0;
    recordInitialHeadTimeSecondsRef.current =
      (typeof getHeadTimeSeconds === "function" ? getHeadTimeSeconds() : 0) || 0;

    // Clear previous recorders
    trackRecordersRef.current = new Map();

    // Create one MediaRecorder per armed track, recording that track's bus stream
    for (const t of armedTracks) {
      const stream = audioEngine.getTrackRecordStream?.(t.id);
      if (!stream) continue;

      let recorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch (e) {
        continue;
      }

      const entry = { recorder, chunks: [] };
      trackRecordersRef.current.set(t.id, entry);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) entry.chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(entry.chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        entry.chunks = [];

        // If the blob is tiny, it's basically garbage (prevents tiny empty clips)
        if (!blob || blob.size < 1000) return;

        const url = URL.createObjectURL(blob);

        // Clamp duration so you never create a near-zero clip
        const duration = Math.max(0.05, recordDurationRef.current || 0);
        const startTime = recordInitialHeadTimeSecondsRef.current || 0;

        // Replace the live temp clip with the final recorded clip
        setTracks((prev) =>
          (prev || []).map((trk) => {
            if (trk.id !== t.id) return trk;

            const tempId = tempRecClipIdFor(t.id);
            const clips = Array.isArray(trk.clips) ? trk.clips : [];
            const withoutTemp = clips.filter((c) => c.id !== tempId);

            const newClip = {
              id: Date.now() + Math.random(),
              url,
              duration,
              startTime,
              image: null,
            };

            return { ...trk, clips: [...withoutTemp, newClip] };
          })
        );
      };


      try {
        recorder.start();
      } catch (e) {}
    }

    setIsGlobalRecording(true);
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
    recordStartTimeRef.current = performance.now();
    recorder.start();
    setIsRoomRecording(true);
  };

  return {
    recordings,
    recordingsError,

    storageFiles,
    storageError,
    uploadStorageFile,

    isRoomRecording,
    isGlobalRecording,
    toggleGlobalRecord,
    handleRoomRecordToggle,
  };

}
