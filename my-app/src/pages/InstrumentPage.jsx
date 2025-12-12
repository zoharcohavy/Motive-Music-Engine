import React from "react";
import { useInstrumentPageLogic } from "../components/audio/useInstrumentPageLogic";
import RecordingsPanel from "../components/audio/RecordingsPanel";
import TopControls from "../components/audio/TopControls";
import MouseModeToggle from "../components/audio/MouseModeToggle";
import TrackSection from "../components/Tracks/TrackSection";
import RoomModal from "../components/Rooms/RoomModal";

import PianoKeyboard from "../components/audio/SoundBoards/PianoKeyboard";
import DrumMachine from "../components/audio/SoundBoards/DrumMachine";

import { KEYS, getKeyIndexForKeyboardChar } from "../components/audio/constants";
import { useInstrumentHotkeys } from "../components/audio/useInstrumentHotkeys";
import { useDrumPadConfig } from "../components/audio/useDrumPadConfig";

export default function InstrumentPage({ instrument }) {
  const {
    waveform,
    setWaveform,
    effect,
    setEffect,
    recordings,
    recordingsError,
    waveCanvasRef,
    mouseMode,
    setMouseMode,

    tracks,
    selectedTrackId,
    setSelectedTrackId,
    globalZoom,
    changeZoom,
    handleGlobalPlay,
    addTrack,
    deleteTrack,
    handleTrackRecordToggle,
    activeRecordingTrackId,

    handleTrackStripMouseDown,
    handleTrackStripMouseMove,
    handleTrackStripContextMenu,
    trackCanvasRefs,

    activeKeyIds,
    handleKeyMouseDown,
    handleKeyMouseEnter,

    roomId,
    username,
    roomStatus,
    isRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    handleRoomRecordToggle,
    isRoomRecording,
    roomUsernames,
  } = useInstrumentPageLogic();

  // Drum customization foundation (pads + key bindings persisted in localStorage)
  const drumConfig = useDrumPadConfig();

  // This function is how keyboard keys trigger notes/pads.
  const triggerChar = (charLower) => {
    if (instrument === "drums") {
      const pad = drumConfig.getPadForChar(charLower);
      if (pad) handleKeyMouseDown(pad);
      return;
    }

    // piano
    const keyIndex = getKeyIndexForKeyboardChar(charLower);
    if (keyIndex >= 0 && keyIndex < KEYS.length) {
      handleKeyMouseDown(KEYS[keyIndex]);
    }
  };

  // One unified hotkey system for both pages
  useInstrumentHotkeys({
    onPlay: handleGlobalPlay,
    onToggleRecord: () => {
      if (selectedTrackId != null) handleTrackRecordToggle(selectedTrackId);
    },
    triggerChar,
  });

  const isDrums = instrument === "drums";

  return (
    <div className="tone-test-page" style={{ padding: "1rem" }}>
      {/* Recordings list in upper-right */}
      <RecordingsPanel recordings={recordings} recordingsError={recordingsError} />

      {/* Top controls */}
      <TopControls
        waveform={waveform}
        setWaveform={setWaveform}
        effect={effect}
        setEffect={setEffect}
        roomId={roomId}
        roomStatus={roomStatus}
        openRoomModal={openRoomModal}
        disconnectRoom={disconnectRoom}
        handleRoomRecordToggle={handleRoomRecordToggle}
        isRoomRecording={isRoomRecording}
        roomUsernames={roomUsernames}
      />

      {/* Analyser / visualization */}
      <div style={{ marginTop: "12px" }}>
        <canvas
          ref={waveCanvasRef}
          style={{
            width: "100%",
            height: "120px",
            borderRadius: "6px",
            border: "1px solid #444",
            background: "#111",
          }}
        />
      </div>

      {/* Mouse mode toggle */}
      <MouseModeToggle mouseMode={mouseMode} setMouseMode={setMouseMode} />

      {/* Tracks */}
      <TrackSection
        tracks={tracks}
        selectedTrackId={selectedTrackId}
        setSelectedTrackId={setSelectedTrackId}
        globalZoom={globalZoom}
        changeZoom={changeZoom}
        handleGlobalPlay={handleGlobalPlay}
        addTrack={addTrack}
        deleteTrack={deleteTrack}
        handleTrackRecordToggle={handleTrackRecordToggle}
        activeRecordingTrackId={activeRecordingTrackId}
        mouseMode={mouseMode}
        handleTrackStripMouseDown={handleTrackStripMouseDown}
        handleTrackStripMouseMove={handleTrackStripMouseMove}
        handleTrackStripContextMenu={handleTrackStripContextMenu}
        trackCanvasRefs={trackCanvasRefs}
      />

      {/* Soundboard */}
      {isDrums ? (
        <DrumMachine
          pads={drumConfig.pads}
          activeKeyIds={activeKeyIds}
          onMouseDownKey={handleKeyMouseDown}
          onMouseEnterKey={handleKeyMouseEnter}
        />
      ) : (
        <PianoKeyboard
          activeKeyIds={activeKeyIds}
          onMouseDownKey={handleKeyMouseDown}
          onMouseEnterKey={handleKeyMouseEnter}
        />
      )}

      {/* Room modal */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={closeRoomModal}
        roomStatus={roomStatus}
        roomId={roomId}
        username={username}
        connectToRoom={connectToRoom}
        disconnectRoom={disconnectRoom}
      />
    </div>
  );
}
