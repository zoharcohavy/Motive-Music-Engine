import React from "react";
import { useInstrumentPageLogic } from "../components/audio/useInstrumentPageLogic";
import RecordingsPanel from "../components/audio/Engines/RecordingsPanel";
import TopControls from "../components/Controls/TopControls";
import MouseModeToggle from "../components/Controls/MouseModeToggle";
import TrackSection from "../components/Tracks/TrackSection";
import RoomModal from "../components/Rooms/RoomModal";

import PianoKeyboard from "../components/audio/SoundBoards/PianoKeyboard";
import DrumMachine from "../components/audio/SoundBoards/DrumMachine";

import { KEYS, getKeyIndexForKeyboardChar } from "../components/audio/constants";
import { useInstrumentHotkeys } from "../components/audio/SoundBoards/useInstrumentHotkeys";
import { useDrumPadConfig } from "../components/audio/SoundBoards/useDrumPadConfig";
import { usePersistedState } from "../components/ui/usePersistedState";
import CollapsibleNotice from "../components/ui/CollapsibleNotice";


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
    viewStartTime,
    setViewStartTime,
    setViewStartTimeAndSnapHead,
    headTimeSeconds,

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
// Hide advanced panels by default, but remember the user's choice.
  const [isWaveformOpen, setIsWaveformOpen] = usePersistedState(
    "ui.instrumentPage.waveformOpen",
    false
  );
  const [isMouseModeOpen, setIsMouseModeOpen] = usePersistedState(
    "ui.instrumentPage.mouseModeOpen",
    false
  );


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
    <div className="tone-test-page app-shell">
      {/* Recordings list in upper-right */}
      <RecordingsPanel recordings={recordings} recordingsError={recordingsError} />

      {/* Top controls */}
      <TopControls
        waveform={waveform}
        setWaveform={setWaveform}
        effect={effect}
        setEffect={setEffect}
        showWaveform={!isDrums}
        roomId={roomId}
        roomStatus={roomStatus}
        openRoomModal={openRoomModal}
        disconnectRoom={disconnectRoom}
        handleRoomRecordToggle={handleRoomRecordToggle}
        isRoomRecording={isRoomRecording}
        roomUsernames={roomUsernames}
      />

            {/* Live waveform (collapsible) */}
      <CollapsibleNotice
        title="Live waveform"
        subtitle="(click to expand)"
        isOpen={isWaveformOpen}
        setIsOpen={setIsWaveformOpen}
        className="notice--mini"
      >
        <div className="card">
          <canvas ref={waveCanvasRef} className="wave-canvas" />
        </div>
      </CollapsibleNotice>

      {/* Mouse mode (collapsible) */}
      <CollapsibleNotice
        title="Mouse mode"
        subtitle="(advanced)"
        isOpen={isMouseModeOpen}
        setIsOpen={setIsMouseModeOpen}
        className="notice--mini"
      >
        <div className="card">
          <MouseModeToggle mouseMode={mouseMode} setMouseMode={setMouseMode} />
        </div>
      </CollapsibleNotice>


      {/* Tracks */}
      <TrackSection
        tracks={tracks}
        viewStartTime={viewStartTime}
        setViewStartTime={setViewStartTime}
        headTimeSeconds={headTimeSeconds}
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
