// src/components/audio/Engines/useRecording.js
import { useRef, useState, useEffect } from "react";
import { API_BASE } from "../constants";

/**
 * Recording hook:
 * - records armed tracks (per-track MediaRecorder)
 * - for Room Record: records armed tracks and uploads each track blob into a shared ROOMNAME:# folder
 * - drives "live growing clip" visuals + tapehead motion while recording
 */
export function useRecording({
  audioEngine,
  roomId,
  getHeadTimeSeconds,
  setViewStartTime,
  trackCanvasRefs, // kept for signature compatibility (not used here)
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

  const { getAudioContext } = audioEngine;

  // UI state
  const [recordings, setRecordings] = useState([]);
  const [recordingsError, setRecordingsError] = useState(null);
  const [storageFiles, setStorageFiles] = useState([]);
  const [storageError, setStorageError] = useState(null);

  // Room session upload metadata
  const roomSessionFolderRef = useRef(null);
  const roomUsernameRef = useRef("Anonymous");

  // Flags for UI
  const [isRoomRecording, setIsRoomRecording] = useState(false);
  const [isGlobalRecording, setIsGlobalRecording] = useState(false);

  // Internal refs for the current recording session
  const recordingTargetTrackIdsRef = useRef([]); // armed track ids for live-growing clips
  const trackRecordersRef = useRef(new Map()); // trackId -> { recorder, chunks: [] }

  const recordStartTimeRef = useRef(null); // performance.now()
  const recordDurationRef = useRef(0);

  // The absolute head time (seconds) when record began
  const recordInitialHeadTimeSecondsRef = useRef(0);

  // Snapshot the viewport at record start so we don't "jump"
  const recordViewStartAtStartRef = useRef(0);
  const lastViewStartDuringRecordRef = useRef(0);
  const stoppingRoomRef = useRef(false);
  const pendingRoomStopsRef = useRef(0);
  const stopRoomResolveRef = useRef(null);

  const BASE_STRIP_SECONDS = 10;

  const tempRecClipIdFor = (trackId) => `__REC_LIVE__${trackId}`;

  const getTrackLength = (track) => {
    const zoom = track.zoom || 1;
    return BASE_STRIP_SECONDS / zoom;
  };

  const getCurrentHeadAbsSeconds = () => {
    const tracksNow = tracksRef.current || [];
    if (!tracksNow.length) return 0;

    const viewStart =
      typeof getViewStartTime === "function" ? (getViewStartTime() || 0) : 0;

    const t0 = tracksNow[0];
    const len = getTrackLength(t0) || 0;

    // headPos is 0..1 within the current viewport; convert to absolute seconds
    const hp = typeof t0.headPos === "number" ? t0.headPos : 0;
    return viewStart + hp * len;
  };


  // IMPORTANT:
  // Only trust getHeadTimeSeconds() if it agrees with what we are actually drawing.
  // Otherwise, derive from (viewStartTime + headPos * trackLength).
  const getCurrentHeadTimeSecondsSafe = () => {
    const tracksNow = tracksRef?.current || [];
    const refTrack = tracksNow[0];
    if (!refTrack) return 0;

    const viewStart =
      typeof getViewStartTime === "function" ? Number(getViewStartTime() || 0) : 0;

    const len = getTrackLength(refTrack);
    const headPos = Number(refTrack.headPos);
    const clampedPos = Number.isFinite(headPos) ? Math.max(0, Math.min(1, headPos)) : 0;

    const derived = Number.isFinite(len) && len > 0 ? viewStart + clampedPos * len : viewStart;

    // Prefer provided getter ONLY if it looks consistent with the derived visual position.
    const ht =
      typeof getHeadTimeSeconds === "function" ? Number(getHeadTimeSeconds()) : NaN;

    if (!Number.isFinite(ht)) return derived;

    // If it differs too much, it's stale (this is what causes the “jump to 0”).
    const tolerance = Number.isFinite(len) && len > 0 ? len * 0.75 : 1.0;
    if (Math.abs(ht - derived) > tolerance) return derived;

    return ht;
  };



  // ----- recordings list from server -----
  const fetchRecordings = async () => {
    try {
      setRecordingsError(null);
      const res = await fetch(`${API_BASE}/api/recordings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

      // If backend doesn't support storage yet, treat as empty
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
    fetchStorage(); // refresh
    return data;
  };

  useEffect(() => {
    fetchRecordings();
    fetchStorage();
  }, []);

  // ---------- Room upload helper (per-track blob) ----------
  const uploadRoomTrackBlob = async ({
    blob,
    sessionFolder,
    username,
    trackId,
    trackName,
  }) => {
    try {
      if (!blob) return;
      if (!roomId) return;

      const safeTrackName = String(trackName ?? `track_${trackId}`).trim() || `track_${trackId}`;

      const formData = new FormData();

      // IMPORTANT: append text fields FIRST so multer destination() can read req.body.*
      formData.append("roomName", roomId);
      formData.append("roomSessionFolder", sessionFolder || roomId);
      formData.append("username", username || "Anonymous");
      formData.append("trackName", safeTrackName);

      // Append the file LAST
      formData.append("audio", blob, `${safeTrackName}.webm`);


      const res = await fetch(`${API_BASE}/api/recordings/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("Room track upload failed:", res.status);
        return;
      }
    } catch (e) {
      console.error("uploadRoomTrackBlob error:", e);
    }
  };

  // ---------- Tapehead + live-growing clip animation while any recording is active ----------
  useEffect(() => {
    let frameId = null;

    const step = () => {
      // Any per-track recorder currently recording?
      const anyTrackRecorderRecording = (() => {
        const map = trackRecordersRef.current;
        if (!map || map.size === 0) return false;
        for (const { recorder: r } of map.values()) {
          if (r && r.state === "recording") return true;
        }
        return false;
      })();

      const isRecording = anyTrackRecorderRecording || isGlobalRecording || isRoomRecording;

      if (isRecording && recordStartTimeRef.current != null) {
        const now = performance.now();
        const elapsedSec = (now - recordStartTimeRef.current) / 1000;
        recordDurationRef.current = elapsedSec;

        const tracksNow = tracksRef.current || [];
        if (!tracksNow.length) {
          frameId = window.requestAnimationFrame(step);
          return;
        }

        // Absolute head time = (abs start time when record began) + elapsed
        const headTimeAbs = (recordInitialHeadTimeSecondsRef.current || 0) + elapsedSec;

        if (typeof setHeadTimeSeconds === "function") {
          setHeadTimeSeconds(headTimeAbs);
        }

        // Use first track as viewport length reference (shared viewStart)
        const refTrack = tracksNow[0];
        const trackLength = getTrackLength(refTrack);

        // IMPORTANT: use the snapshot viewStart from record start so we don't jump
        let viewStart = lastViewStartDuringRecordRef.current;

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

        // Update headPos for ALL tracks (yellow head animates everywhere)
        setTracks((prev) =>
          (prev || []).map((t) => {
            const len = getTrackLength(t);
            if (!len) return t;
            const frac = (headTimeAbs - viewStart) / len;
            const headPos = Math.max(0, Math.min(1, frac));
            return { ...t, headPos };
          })
        );

        // Live “growing” clip while recording (only for armed target tracks)
        const startTime = recordInitialHeadTimeSecondsRef.current || 0;
        const duration = Math.max(0, recordDurationRef.current || 0);
        const targetIds = new Set(recordingTargetTrackIdsRef.current || []);

        if (targetIds.size > 0) {
          setTracks((prev) =>
            (prev || []).map((t) => {
              const tempId = tempRecClipIdFor(t.id);

              if (!targetIds.has(t.id)) {
                const cleaned = (t.clips || []).filter((c) => c.id !== tempId);
                return cleaned.length === (t.clips || []).length ? t : { ...t, clips: cleaned };
              }

              const clips = Array.isArray(t.clips) ? t.clips : [];
              const tempClip = { id: tempId, startTime, duration, url: null, image: null, isTemp: true };

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

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [tracksRef, setTracks, setHeadTimeSeconds, setViewStartTime, isGlobalRecording, isRoomRecording]);

  // ---------- Global record (armed tracks only) ----------
  const toggleGlobalRecord = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // STOP
    if (isGlobalRecording) {
      const map = trackRecordersRef.current;
      for (const { recorder } of map.values()) {
        try {
          if (recorder?.state === "recording") recorder.stop();
        } catch {}
      }

      setIsGlobalRecording(false);

      // Stop live-growing clip updates
      recordingTargetTrackIdsRef.current = [];
      recordStartTimeRef.current = null;

      return;
    }

    // START: record ONLY armed tracks
    const tracksNow = tracksRef.current || [];
    const armedTracks = tracksNow.filter((t) => t.isRecEnabled === true);
    if (!armedTracks.length) return;

    recordingTargetTrackIdsRef.current = armedTracks.map((t) => t.id);

    // Snapshot viewport + head time (prevents jump)
    const viewStartNow = (typeof getViewStartTime === "function" ? getViewStartTime() : 0) || 0;
    recordViewStartAtStartRef.current = viewStartNow;
    lastViewStartDuringRecordRef.current = viewStartNow;

    recordStartTimeRef.current = performance.now();
    recordDurationRef.current = 0;
    recordInitialHeadTimeSecondsRef.current = getCurrentHeadTimeSecondsSafe();

    // Clear previous recorders
    trackRecordersRef.current = new Map();

    for (const t of armedTracks) {
      const stream = audioEngine.getTrackRecordStream?.(t.id);
      if (!stream) continue;

      let recorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        continue;
      }

      const entry = { recorder, chunks: [] };
      trackRecordersRef.current.set(t.id, entry);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) entry.chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(entry.chunks, { type: recorder.mimeType || "audio/webm" });
        entry.chunks = [];
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const duration = Math.max(0.05, recordDurationRef.current || 0);
        const startTime = recordInitialHeadTimeSecondsRef.current || 0;

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
      } catch {}
    }

    setIsGlobalRecording(true);
  };

  // ---------- Room Record (armed tracks only, plus uploads into shared folder) ----------
  const startRoomArmedTracks = (sessionFolder, username) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Prevent conflicts with other recording modes
    if (isGlobalRecording || isRoomRecording) return;

    const tracksNow = tracksRef.current || [];
    const armedTracks = tracksNow.filter((t) => t.isRecEnabled === true);
    if (!armedTracks.length) return;

    const sf = (sessionFolder || roomId || "").trim();
    if (!sf || !roomId) return;

    // store for uploads
    roomSessionFolderRef.current = sf;
    roomUsernameRef.current = username || "Anonymous";

    // Snapshot viewport + head time (prevents jump)
    const viewStartNow = (typeof getViewStartTime === "function" ? getViewStartTime() : 0) || 0;
    recordViewStartAtStartRef.current = viewStartNow;
    lastViewStartDuringRecordRef.current = viewStartNow;

    // baseline for growing clips + head animation
    recordStartTimeRef.current = performance.now();
    recordDurationRef.current = 0;
    recordInitialHeadTimeSecondsRef.current = getCurrentHeadTimeSecondsSafe();

    // Tell the animation loop which tracks get live growing clips
    recordingTargetTrackIdsRef.current = armedTracks.map((t) => t.id);

    // Clear previous recorders
    trackRecordersRef.current = new Map();

    for (const t of armedTracks) {
      const stream = audioEngine.getTrackRecordStream?.(t.id);
      if (!stream) continue;

      let recorder;
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        continue;
      }

      const entry = { recorder, chunks: [] };
      trackRecordersRef.current.set(t.id, entry);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) entry.chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const finishOneStop = () => {
          if (!stoppingRoomRef.current) return;

          pendingRoomStopsRef.current = Math.max(0, pendingRoomStopsRef.current - 1);

          if (pendingRoomStopsRef.current === 0) {
            stoppingRoomRef.current = false;
            recordingTargetTrackIdsRef.current = [];
            recordStartTimeRef.current = null;
            setIsRoomRecording(false);

            // Final refresh (delayed) so remote uploads land before we list recordings
            setTimeout(() => {
              fetchRecordings().catch(() => {});
            }, 350);

            if (typeof stopRoomResolveRef.current === "function") {
              stopRoomResolveRef.current();
              stopRoomResolveRef.current = null;
            }
          }
        };

        try {
          const blob = new Blob(entry.chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          entry.chunks = [];

          // If blob is empty/tiny, still count this track as "stopped" to avoid deadlock.
          if (!blob) {
            finishOneStop();
            return;
          }

          // 1) Finalize local clip (replace temp)
          const url = URL.createObjectURL(blob);
          const duration = Math.max(0.05, recordDurationRef.current || 0);
          const startTime = recordInitialHeadTimeSecondsRef.current || 0;

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

          // 2) Upload to shared room folder
          await uploadRoomTrackBlob({
            blob,
            sessionFolder: roomSessionFolderRef.current || roomId,
            username: roomUsernameRef.current || "Anonymous",
            trackId: t.id,
            trackName: t.name,
          });


          // Count down regardless of upload success
          finishOneStop();
        } catch (e) {
          console.error("Room recorder.onstop error:", e);
          // Never deadlock stopping
          finishOneStop();
        }
      };


      try {
        recorder.start();
      } catch {}
    }

    setIsRoomRecording(true);
  };

  const stopRoomArmedTracks = () => {
    const map = trackRecordersRef.current;

    // Stop anything that's actually recording, regardless of isRoomRecording state.
    const entries = Array.from(map.values()).filter(
      (x) => x?.recorder && x.recorder.state === "recording"
    );

    // If nothing is actively recording, finalize immediately (also clears temp clips)
    if (entries.length === 0) {
      stoppingRoomRef.current = false;
      pendingRoomStopsRef.current = 0;
      stopRoomResolveRef.current = null;

      recordingTargetTrackIdsRef.current = [];
      recordStartTimeRef.current = null;
      setIsRoomRecording(false);
      setTimeout(() => {
          fetchRecordings().catch(() => {});
        }, 350);
        return Promise.resolve();
      }
    // Halt the tapehead/visuals immediately when "Stop Room Recording" is triggered,
    // but still allow MediaRecorder.onstop handlers to finish uploads + clip finalization.
    if (recordStartTimeRef.current != null) {
      const now = performance.now();
      recordDurationRef.current = (now - recordStartTimeRef.current) / 1000;
    }
    recordStartTimeRef.current = null;
    setIsRoomRecording(false);

    stoppingRoomRef.current = true;
    pendingRoomStopsRef.current = entries.length;

    // Return a promise so the UI can stay “finalizing” until all onstop handlers finish
    const p = new Promise((resolve) => {
      stopRoomResolveRef.current = resolve;
    });

    for (const { recorder } of entries) {
      try {
        recorder.stop();
      } catch {}
    }
    return p;
  };



  const startGlobalRecord = async () => {
    if (!isGlobalRecording) await toggleGlobalRecord();
  };

  const stopGlobalRecord = async () => {
    if (isGlobalRecording) await toggleGlobalRecord();
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
    startGlobalRecord,
    stopGlobalRecord,

    // Room record = armed tracks + upload into shared ROOMNAME:# folder
    startRoomArmedTracks,
    stopRoomArmedTracks,
  };
}
