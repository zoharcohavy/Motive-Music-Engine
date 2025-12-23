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

  // --- Room / WebSocket ---
  // Room notifies us when a remote user plays a note.
  const room = useRoom({
    onRemoteNote: ({ freq, waveform, effects, effect }) => {
      const engine = audioEngineRef.current;
      if (!engine) return;

      // Play the remote note through our local audio engine
      engine.playRemoteNote(freq, {
        waveform,
        effects: effects ?? effect,
      });

      // Optionally sync local effect with the room’s effect
      if ((effects || effect) && typeof engine.setEffectFromRoom === "function") {
        engine.setEffectFromRoom(effects ?? effect);
      }
    },
  });

  // --- Audio engine ---
  // Give the audio engine awareness of the room so it can broadcast notes.
  const audioEngine = useAudioEngine({
    roomStatus: room.roomStatus,
    sendRoomMessage: room.sendRoomMessage,
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
    handleGlobalPlay: trackModel.handleGlobalPlay,
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
    toggleGlobalRecord: recording.toggleGlobalRecord,
    recordings: recording.recordings,
    recordingsError: recording.recordingsError,
    storageFiles: recording.storageFiles,
    storageError: recording.storageError,
    handleTrackUpload,

    handleTrackRecordToggle: recording.handleTrackRecordToggle,
    handleRoomRecordToggle: recording.handleRoomRecordToggle,
    isRoomRecording: recording.isRoomRecording,

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
