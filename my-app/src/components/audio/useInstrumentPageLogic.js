import { useRef, useEffect, useState } from "react";
import { useAudioEngine } from "./Engines/useAudioEngine";
import { useRoom } from "../Rooms/useRoom";
import { useTrackModel } from "../Tracks/useTrackModel";
import { useRecording } from "./Engines/useRecording";
import { API_BASE } from "./constants";



/**
 * It wires together:
 * - Audio engine (local piano + waveform)
 * - Track model (tracks, tape head, zoom, dragging)
 * - Transport (through useTrackModel)
 * - Room (WebSocket rooms)
 * - Recording (MediaRecorder + track / room recordings)
 */
export function useInstrumentPageLogic() {
  // We need a ref so the room callback can call audioEngine.playRemoteNote
  const audioEngineRef = useRef(null);

  // NEW: make transport controls available to callbacks created before trackModel
  const transportPlayRef = useRef(null);
  const transportPlayingRef = useRef(false);

  // Always-available “bridge” so audioEngine can send WS messages even though room is created first
  const sendRoomMessageRef = useRef(null);

  const precheckResponderRef = useRef(null);
  const precheckCollectorRef = useRef(null);
  const roomPrecheckSessionRef = useRef({ requestId: null, results: {} });


  // Keep room status reactive for useAudioEngine (a ref won’t trigger updates)
  const [roomStatusForEngine, setRoomStatusForEngine] = useState("disconnected");

  // Make room recording callbacks safe (avoid “recording is undefined” race)
  const recordingRef = useRef(null);

  // Username can be stale inside callbacks; keep a ref
  const usernameRef = useRef("Anonymous");


  // --- Room / WebSocket ---
  // Room notifies us when a remote user plays a note.
  const room = useRoom({
    onRemoteNote: ({ freq, waveform, effects, effect }) => {
      const engine = audioEngineRef.current;
      if (!engine) return;

      engine.playRemoteNote(freq, { waveform, effects: effects ?? effect });
    },

    onRoomRecordStart: (sessionFolder) => {
      const uiBlockedNow = Boolean(recordGuard) || Boolean(room.isRoomModalOpen);
      if (uiBlockedNow) return;

      recordingRef.current?.startRoomArmedTracks(sessionFolder, usernameRef.current);

      // NEW: auto-start transport so Play flips to Pause while room recording
      if (!transportPlayingRef.current && typeof transportPlayRef.current === "function") {
          transportPlayRef.current();
      }
    },



    onRoomRecordStop: (sessionFolder) => {
      // SAFE + returns promise so UI stays “finalizing” until finished
      return recordingRef.current?.stopRoomArmedTracks(sessionFolder);
    },
    onPrecheckRequest: (msg) => precheckResponderRef.current?.(msg),
    onPrecheckResponse: (msg) => precheckCollectorRef.current?.(msg),

  });
  useEffect(() => {
    // Bridge for engine broadcasting notes
    sendRoomMessageRef.current = room.sendRoomMessage;

    // Keep engine updated when room connects/disconnects
    setRoomStatusForEngine(room.roomStatus);

    // Keep username stable inside room-record callbacks
    usernameRef.current = room.username || "Anonymous";
  }, [room.sendRoomMessage, room.roomStatus, room.username]);


  // --- Audio engine ---
  // Give the audio engine awareness of the room so it can broadcast notes.
  const audioEngine = useAudioEngine({
    roomStatus: roomStatusForEngine,
    sendRoomMessage: (msg) => sendRoomMessageRef.current?.(msg),
  });



  // Make the engine accessible to the room callback
  audioEngineRef.current = audioEngine;

  // --- Tracks + transport (global tape head) ---
  // useTrackModel already owns useTransport internally and exposes:
  // - tracks, setTracks
  // - globalZoom, changeZoom
  // - mouseMode, setMouseMode
  // - handleGlobalPlay, handleTrackStripMouseDown, handleTrackStripMouseMove
  // Wrap clip playback so each clip routes through its track bus (mute/solo)
  const playClipUrl = (url, opts = {}) => {
    const trackId = opts.trackId;
    const destinationNode =
      typeof trackId === "number" ? audioEngine.getOrCreateTrackBus(trackId) : null;

    return audioEngine.playUrl(url, { ...opts, destinationNode });
  };

  const trackModel = useTrackModel({ playClipUrl });

  // Keep transport helpers in refs so callbacks defined above can trigger Play
  transportPlayRef.current = trackModel.handleGlobalPlay;
  useEffect(() => {
      transportPlayingRef.current = !!trackModel.isTransportPlaying;
  }, [trackModel.isTransportPlaying]);

  
  // Aliases for recording-guard helpers (so we can use simple names below)
  const { tracks, setTracks, headTimeSeconds } = trackModel;

  // --- Recording guard (blocks recording if ARMED tracks have clips to the right of tape-head) ---
  const [recordGuard, setRecordGuard] = useState(null);
  const clearRecordGuard = () => setRecordGuard(null);
  // Any blocking UI that could freeze/interrupt room-record start
  const isUiBlocked = Boolean(recordGuard) || Boolean(room.isRoomModalOpen);


  const getArmedTracks = () => (tracks || []).filter((t) => t?.isRecEnabled);

  const getConflictingClips = () => {
    const head = Number(trackModel.headTimeSeconds || 0);
    const armed = getArmedTracks();
    const conflicts = [];

    for (const t of armed) {
      for (const c of t.clips || []) {
        const s = Number(c.startTime || 0);
        const d = Number(c.duration || 0);
        if (s + d > head) 
          conflicts.push({ trackId: t.id, clipId: c.id });
      }
    }
    return conflicts;
  };
  const getLocalRoomPrecheckSummary = () => {
    const armed = getArmedTracks();

    // IMPORTANT: read the latest head time right now
    const head = Number(trackModel.headTimeSeconds || 0);

    let tracksNeedingClear = 0;
    let clipCount = 0;

    for (const t of armed) {
      let trackHasConflict = false;
      for (const c of t.clips || []) {
        const s = Number(c.startTime || 0);
        const d = Number(c.duration || 0);

        // Only block if the clip truly overlaps/extends past the playhead
        if (s + d > head) {
          clipCount += 1;
          trackHasConflict = true;
        }
      }
      if (trackHasConflict) tracksNeedingClear += 1;
    }

    return { tracksNeedingClear, clipCount };
  };

  precheckResponderRef.current = (msg) => {
    const requestId = msg?.requestId;
    if (!requestId) return;

    const summary = getLocalRoomPrecheckSummary();

    room.sendRoomMessage?.({
      type: "precheck_response",
      requestId,
      username: room.username || "Anonymous",
      tracksNeedingClear: summary.tracksNeedingClear,
      clipCount: summary.clipCount,
      uiBlocked: Boolean(isUiBlocked),
    });

  };


  const deleteClipsToRightOfHead = () => {
    const conflicts = getConflictingClips();
    if (!conflicts.length) return;

    setTracks((prev) =>
      (prev || []).map((t) => {
        if (!t?.isRecEnabled) return t;

        const ids = new Set(
          conflicts.filter((x) => x.trackId === t.id).map((x) => x.clipId)
        );
        if (!ids.size) return t;

        return { ...t, clips: (t.clips || []).filter((c) => !ids.has(c.id)) };
      })
    );
  };

  const checkAndBlockRecordingIfNeeded = () => {
    const conflicts = getConflictingClips();
    if (!conflicts.length) return false;

    setRecordGuard({ clipCount: conflicts.length });
    return true;
  };

  // WRAPPERS: these are what actually stop recording from starting
  const requestToggleGlobalRecord = () => {
    const currentlyRecording = Boolean(recording?.isGlobalRecording);

    // Only block when STARTING (not when STOPPING)
    if (!currentlyRecording) {
      if (checkAndBlockRecordingIfNeeded()) return;
      // NEW: when starting a fresh recording, auto-start transport
      if (!transportPlayingRef.current && typeof transportPlayRef.current === "function") {
          transportPlayRef.current();
      }
    }

    recording?.toggleGlobalRecord?.();
  };



  const requestToggleRoomRecord = async () => {
    // 1) Local block first (use existing popup behavior)
    if (checkAndBlockRecordingIfNeeded()) return;

    // 2) If not connected, just do nothing
    if (room.roomStatus !== "connected") return;

    // 3) Start a room-wide precheck
    const requestId =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    roomPrecheckSessionRef.current = { requestId, results: {} };

    // Collector: store responses for this requestId
    precheckCollectorRef.current = (msg) => {
      if (msg?.requestId !== requestId) return;
      const u = msg?.username || "Unknown";
      roomPrecheckSessionRef.current.results[u] = {
        username: u,
        tracksNeedingClear: Number(msg.tracksNeedingClear || 0),
        clipCount: Number(msg.clipCount || 0),
        uiBlocked: Boolean(msg.uiBlocked),
      };
    };

        // Ask everyone to report (NOTE: WS servers often do NOT echo to sender)
    // So we ALWAYS include our own result immediately.
    const selfUsername = room.username || "Anonymous";
    const selfSummary = getLocalRoomPrecheckSummary();
    roomPrecheckSessionRef.current.results[selfUsername] = {
      username: selfUsername,
      tracksNeedingClear: Number(selfSummary.tracksNeedingClear || 0),
      clipCount: Number(selfSummary.clipCount || 0),
      uiBlocked: Boolean(isUiBlocked),
    };

    room.sendRoomMessage?.({ type: "precheck_request", requestId });

    // Wait a short moment to gather responses
    await new Promise((r) => setTimeout(r, 900));

    const resultsObj = roomPrecheckSessionRef.current.results || {};
    const results = Object.values(resultsObj);

    // Require everyone to respond; missing users are treated as "not ready"
    const expected = Array.from(new Set([...(room.roomUsernames || []), selfUsername]));
    const missing = expected.filter((name) => !resultsObj[name]);

    if (missing.length) {
      setRecordGuard({ mode: "ready" });
      return;
    }

    const blockedUsers = results.filter((x) => x.uiBlocked);
    if (blockedUsers.length) {
      setRecordGuard({ mode: "ready" }); // simplest popup mode
      return;
    }


    // If anyone needs clearing, block with room-style popup
    const offenders = results.filter((x) => (x.tracksNeedingClear || 0) > 0);

    if (offenders.length) {
      setRecordGuard({
        mode: "room",
        offenders,
        selfUsername: room.username || "Anonymous",
      });
      return;
    }

    // If all clear, start room record
    room.toggleRoomRecord?.();
  };

    // Play button behavior:
    // - If any recording is active (global or room), treat a click as:
    //   1) stop the active recording(s)
    //   2) pause the transport so the button flips back to Play
    // - Otherwise, just toggle transport play/pause normally.
    const handlePlayButtonClick = () => {
        const isGlobalRec = Boolean(recording?.isGlobalRecording);
        const isRoomRec = Boolean(room?.roomIsRecording);

        const anyRecording = isGlobalRec || isRoomRec;

        if (anyRecording) {
            // Stop whichever recording mode is active.
            if (isGlobalRec) {
                // Use the guarded wrapper so we keep any future logic consistent.
                requestToggleGlobalRecord();
            }

            if (isRoomRec) {
                // Mirror the behavior of the room record button in TopControls.
                requestToggleRoomRecord();
            }

            // Then pause transport if it is currently playing.
            if (trackModel?.isTransportPlaying && typeof trackModel?.handleGlobalPlay === "function") {
                trackModel.handleGlobalPlay();
            }

            return;
        }

        // Normal play/pause toggle when nothing is recording.
        trackModel?.handleGlobalPlay?.();
    };




  // Keep audio routing in sync with track mute/solo and live inputs
  useEffect(() => {
    audioEngine.syncTrackBuses(trackModel.tracks);

    // Update live inputs (device + FX) for any tracks that have an input selected
    (trackModel.tracks || []).forEach((t) => {
      if (t.inputDeviceId) {
        audioEngine.updateLiveInputForTrack(t.id, t.inputDeviceId, t.effects || []);
      } else {
        // ensure disconnected if cleared
        audioEngine.updateLiveInputForTrack(t.id, null, []);
      }
    });
  }, [audioEngine, trackModel.tracks]);
  // --- Recording (MediaRecorder) ---
  // New hook signature:
  //   useRecording({
  //     audioEngine,
  //     trackCanvasRefs,
  //     tracksRef,
  //     setTracks,
  //     activeRecordingTrackId,
  //     setActiveRecordingTrackId,
  //   })
  const recording = useRecording({
    audioEngine,
    roomId: room.roomId, 
    trackCanvasRefs: trackModel.trackCanvasRefs,
    tracksRef: trackModel.tracksRef,
    setTracks: trackModel.setTracks,
    setActiveRecordingTrackId: trackModel.setActiveRecordingTrackId,

    setHeadTimeSeconds: trackModel.setHeadTimeSeconds,
    getHeadTimeSeconds: () => trackModel.headTimeSeconds,
    getViewStartTime: () => trackModel.viewStartTime,
    setViewStartTime: trackModel.setViewStartTime,
    getTrackLength: trackModel.getTrackLength,
  });
  recordingRef.current = recording;

  // NEW: Treat any active recording as a UI lock
    const isRecordingLocked = room.isRoomLocked || recording.isGlobalRecording;

  // --- Keyboard handlers for the PianoKeyboard component ---
  const handleKeyMouseDown = (key) => {
    if (!key) return;

    const hasFreq = typeof key.freq === "number";
    const hasSample = typeof key.sampleUrl === "string";

    if (!hasFreq && !hasSample) return;

    // Highlight key/pad
    trackModel.setActiveKeyIds((prev) =>
      prev.includes(key.id) ? prev : [...prev, key.id]
    );

    // Only hear FX from the currently selected track
    const tracksNow = trackModel.tracksRef?.current || [];
    const sel = tracksNow.find((t) => t.id === trackModel.selectedTrackId);
    const selectedFx = sel?.effects || [];

    // Play piano note OR drum sample (through selected track FX)
    const dest = audioEngine.getOrCreateTrackBus?.(trackModel.selectedTrackId);

    // Play piano note OR drum sample (through selected track FX) AND route into selected track bus
    if (hasSample && audioEngine.playSample) {
      audioEngine.playSample(key.sampleUrl, {
        source: "local",
        effectsOverride: selectedFx,
        destinationNode: dest,
      });
    } else if (hasFreq) {
      audioEngine.playNote(key.freq, {
        source: "local",
        effectsOverride: selectedFx,
        destinationNode: dest,
      });
    }



    // Clear highlight shortly after
    setTimeout(() => {
      trackModel.setActiveKeyIds((prev) =>
        prev.filter((id) => id !== key.id)
      );
    }, 200);
  };

  const handleKeyMouseEnter = (key) => {
    if (!key) return;

    const hasFreq = typeof key.freq === "number";
    const hasSample = typeof key.sampleUrl === "string";

    if (!hasFreq && !hasSample) return;

    trackModel.setActiveKeyIds((prev) =>
      prev.includes(key.id) ? prev : [...prev, key.id]
    );

    // Only hear FX from the currently selected track
    const tracksNow = trackModel.tracksRef?.current || [];
    const sel = tracksNow.find((t) => t.id === trackModel.selectedTrackId);
    const selectedFx = sel?.effects || [];

    // Play through selected track FX
    const dest = audioEngine.getOrCreateTrackBus?.(trackModel.selectedTrackId);

    // Play piano note OR drum sample (through selected track FX) AND route into selected track bus
    if (hasSample && audioEngine.playSample) {
      audioEngine.playSample(key.sampleUrl, {
        source: "local",
        effectsOverride: selectedFx,
        destinationNode: dest,
      });
    } else if (hasFreq) {
      audioEngine.playNote(key.freq, {
        source: "local",
        effectsOverride: selectedFx,
        destinationNode: dest,
      });
    }



    setTimeout(() => {
      trackModel.setActiveKeyIds((prev) =>
        prev.filter((id) => id !== key.id)
      );
    }, 200);
  };

  // ===== Upload an existing audio file and place it on a track as a clip =====
  const getAudioDurationSeconds = (file) =>
    new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.src = url;

        audio.onloadedmetadata = () => {
          const d = Number(audio.duration);
          URL.revokeObjectURL(url);
          resolve(Number.isFinite(d) ? d : 0);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read audio metadata"));
        };
      } catch (e) {
        reject(e);
      }
    });

  const clipsOverlap = (a, b) => {
    const aStart = a.startTime || 0;
    const aEnd = (a.startTime || 0) + (a.duration || 0);
    const bStart = b.startTime || 0;
    const bEnd = (b.startTime || 0) + (b.duration || 0);
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
  };

  const willOverlap = (clips, candidate) =>
    (clips || []).some((c) => clipsOverlap(c, candidate));

  const handleTrackUpload = async (trackId, file) => {
    if (!file) return;

    // 1) Upload to server-side "storage" folder
    const { filename } = await recording.uploadStorageFile(file);

    // 2) Get duration so we can size the clip on the timeline
    const duration = await getAudioDurationSeconds(file);

    // 3) Place at the current playhead time (absolute seconds)
    const clipStartTime =
      typeof trackModel.headTimeSeconds === "number" ? trackModel.headTimeSeconds : 0;

    const newClip = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      url: `${API_BASE}/storage/${filename}`,
      duration,
      startTime: clipStartTime,
      image: null,
    };

    // 4) Decide if it overlaps on the requested track (using current state)
    const targetTrack = (trackModel.tracks || []).find((t) => t.id === trackId);
    const existingClips = targetTrack?.clips || [];
    const overlaps = willOverlap(existingClips, newClip);

    if (!overlaps) {
      // No overlap → add to the selected track
      trackModel.setTracks((prev) =>
        prev.map((t) => {
          if (t.id !== trackId) return t;
          return { ...t, clips: [...(t.clips || []), newClip] };
        })
      );
      return;
    }

    // Overlap → create a NEW track at the bottom and add the clip there
    const newTrackId = trackModel.nextTrackId;

    const newTrack = {
      id: newTrackId,
      name: String(newTrackId),
      zoom: trackModel.globalZoom,
      headPos: 0,
      clips: [newClip],
      hasRecording: false,
      recordingUrl: null,
      recordingDuration: 0,
      tapeHeadPos: 0,
      recordingImage: null,
      clipStartPos: 0,
      heightPx: trackModel.DEFAULT_TRACK_HEIGHT_PX,
    };

    trackModel.setTracks((prev) => [...prev, newTrack]);
    trackModel.setNextTrackId((id) => id + 1);

    trackModel.setSelectedTrackId(newTrackId);
  };


  // --- Keyboard handlers (computer keyboard → piano keys) ---
  // NOTE: if you had keydown/keyup listeners in the old monolithic hook,
  // you probably moved them to the page component or elsewhere.
  // The audioEngine already exposes handleKeyMouseDown / handleKeyMouseEnter
  // for the visual piano component. The actual keyboard events can still
  // be wired up in the React component using KEYS + getKeyIndexForKeyboardChar
  // if needed.

  return {
    // ===== Audio engine / piano =====
    waveform: audioEngine.waveform,
    setWaveform: audioEngine.setWaveform,
    effects: audioEngine.effects,
    setEffects: audioEngine.setEffects,
    waveCanvasRef: audioEngine.waveCanvasRef,
    activeKeyIds: trackModel.activeKeyIds,
    handleKeyMouseDown,
    handleKeyMouseEnter,

    // ===== Mouse mode / transport + tape head (from trackModel) =====
    mouseMode: trackModel.mouseMode,
    setMouseMode: trackModel.setMouseMode,
    globalZoom: trackModel.globalZoom,
    changeZoom: trackModel.changeZoom,
    handleGlobalPlay: handlePlayButtonClick,
    isTransportPlaying: trackModel.isTransportPlaying,
    mouse_interactions: trackModel.mouse_interactions,
    moveClip: trackModel.moveClip,

    // ===== Tracks =====
    tracks: trackModel.tracks,
    setTrackEffects: trackModel.setTrackEffects,
    toggleTrackRecEnabled: trackModel.toggleTrackRecEnabled,
    toggleTrackMuted: trackModel.toggleTrackMuted,
    toggleTrackSolo: trackModel.toggleTrackSolo,
    setTrackInputDevice: trackModel.setTrackInputDevice,
    viewStartTime: trackModel.viewStartTime,
    setViewStartTime: trackModel.setViewStartTime,
    headTimeSeconds: trackModel.headTimeSeconds,

    trackCanvasRefs: trackModel.trackCanvasRefs,
    selectedTrackId: trackModel.selectedTrackId,
    setSelectedTrackId: trackModel.setSelectedTrackId,
    addTrack: trackModel.addTrack,
    deleteTrack: trackModel.deleteTrack,
    renameTrack: trackModel.renameTrack,
    setTrackHeightPx: trackModel.setTrackHeightPx,
    DEFAULT_TRACK_HEIGHT_PX: trackModel.DEFAULT_TRACK_HEIGHT_PX,
    MIN_TRACK_HEIGHT_PX: trackModel.MIN_TRACK_HEIGHT_PX,
    MAX_TRACK_HEIGHT_PX: trackModel.MAX_TRACK_HEIGHT_PX,

    // ===== Recording controls + recordings list =====
    isGlobalRecording: recording.isGlobalRecording,
    toggleGlobalRecord: requestToggleGlobalRecord,
    handleRoomRecordToggle: requestToggleRoomRecord,
    recordGuard,
    clearRecordGuard,
    deleteClipsToRightOfHead: deleteClipsToRightOfHead,

    roomRecordPhase: room.roomRecordPhase,
    isRoomLocked: isRecordingLocked,
    recordings: recording.recordings,
    recordingsError: recording.recordingsError,
    storageFiles: recording.storageFiles,
    storageError: recording.storageError,
    handleTrackUpload,
    
    isRoomRecording: room.roomIsRecording,
    roomCountdownSeconds: room.roomCountdownSeconds,

    // ===== Room / networking =====
    roomId: room.roomId,
    username: room.username,
    roomStatus: room.roomStatus,
    isRoomModalOpen: room.isRoomModalOpen,
    openRoomModal: room.openRoomModal,
    closeRoomModal: room.closeRoomModal,
    connectToRoom: room.connectToRoom,
    disconnectRoom: room.disconnectRoom,
    roomUsernames: room.roomUsernames,
  };
}
