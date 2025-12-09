import { useRef } from "react";
import { useAudioEngine } from "./useAudioEngine";
import { useRoom } from "./useRoom";
import { useTrackModel } from "./useTrackModel";
import { useRecording } from "./useRecording";



/**
 * Main orchestration hook for the ToneTest page.
 *
 * It wires together:
 * - Audio engine (local piano + waveform)
 * - Track model (tracks, tape head, zoom, dragging)
 * - Transport (through useTrackModel)
 * - Room (WebSocket rooms)
 * - Recording (MediaRecorder + track / room recordings)
 */
export function useToneTestLogic() {
  // We need a ref so the room callback can call audioEngine.playRemoteNote
  const audioEngineRef = useRef(null);

  // --- Room / WebSocket ---
  // Room notifies us when a remote user plays a note.
  const room = useRoom({
    onRemoteNote: ({ freq, waveform, effect }) => {
      const engine = audioEngineRef.current;
      if (!engine) return;

      // Play the remote note through our local audio engine
      engine.playRemoteNote(freq, {
        waveform,
        effect,
      });

      // Optionally sync local effect with the room’s effect
      if (effect && typeof engine.setEffectFromRoom === "function") {
        engine.setEffectFromRoom(effect);
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
  const trackModel = useTrackModel();

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
    activeRecordingTrackId: trackModel.activeRecordingTrackId,
    setActiveRecordingTrackId: trackModel.setActiveRecordingTrackId,
  });
  
  // --- Keyboard handlers for the PianoKeyboard component ---
  const handleKeyMouseDown = (key) => {
    if (!key || typeof key.freq !== "number") return;

    // Mark this key as active (for visual highlight)
    trackModel.setActiveKeyIds((prev) =>
      prev.includes(key.id) ? prev : [...prev, key.id]
    );

    // Play the note through the audio engine
    audioEngine.playNote(key.freq, { source: "local" });

    // Clear the active state after a short delay so the key visual resets
    setTimeout(() => {
      trackModel.setActiveKeyIds((prev) =>
        prev.filter((id) => id !== key.id)
      );
    }, 200);
  };

  const handleKeyMouseEnter = (key) => {
    if (!key || typeof key.freq !== "number") return;

    // Optional: you can later restrict this so it only fires when mouse is down
    trackModel.setActiveKeyIds((prev) =>
      prev.includes(key.id) ? prev : [...prev, key.id]
    );

    audioEngine.playNote(key.freq, { source: "local" });

    setTimeout(() => {
      trackModel.setActiveKeyIds((prev) =>
        prev.filter((id) => id !== key.id)
      );
    }, 200);
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
    effect: audioEngine.effect,
    setEffect: audioEngine.setEffect,
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
    handleTrackStripMouseDown: trackModel.handleTrackStripMouseDown,
    handleTrackStripMouseMove: trackModel.handleTrackStripMouseMove,
    moveTrackRecording: trackModel.moveTrackRecording,

    // ===== Tracks =====
    tracks: trackModel.tracks,
    trackCanvasRefs: trackModel.trackCanvasRefs,
    selectedTrackId: trackModel.selectedTrackId,
    setSelectedTrackId: trackModel.setSelectedTrackId,
    addTrack: trackModel.addTrack,
    activeRecordingTrackId: trackModel.activeRecordingTrackId,

    // ===== Recording controls + recordings list =====
    recordings: recording.recordings,
    recordingsError: recording.recordingsError,
    handleTrackRecordToggle: recording.handleTrackRecordToggle,
    handleRoomRecordToggle: recording.handleRoomRecordToggle,
    isRoomRecording: recording.isRoomRecording,

    // ===== Room / networking =====
    roomId: room.roomId,
    roomStatus: room.roomStatus,
    isRoomModalOpen: room.isRoomModalOpen,
    openRoomModal: room.openRoomModal,
    closeRoomModal: room.closeRoomModal,
    connectToRoom: room.connectToRoom,
    disconnectRoom: room.disconnectRoom,
    roomUsernames: room.roomUsernames,
  };
}
