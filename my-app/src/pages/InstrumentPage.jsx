import { useEffect, useState } from "react";
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
import DrumPadCustomizer from "../components/audio/SoundBoards/DrumPadCustomizer";



export default function InstrumentPage({ instrument }) {
  const {
    waveform,
    setWaveform,
    effect,
    setEffect,
    recordings,
    recordingsError,
    storageFiles,
    storageError,
    handleTrackUpload,
    waveCanvasRef,
    mouseMode,
    setMouseMode,

    tracks,
    viewStartTime,
    setViewStartTime,
    headTimeSeconds,

    selectedTrackId,
    setSelectedTrackId,
    globalZoom,
    changeZoom,
    handleGlobalPlay,
    addTrack,
    deleteTrack,
    renameTrack,
    setTrackHeightPx,
    DEFAULT_TRACK_HEIGHT_PX,
    MIN_TRACK_HEIGHT_PX,
    MAX_TRACK_HEIGHT_PX,

    handleTrackRecordToggle,
    activeRecordingTrackId,
    isTransportPlaying,


    mouse_interactions,
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

  const isDrums = instrument === "drums";

  const [showDrumCustomize, setShowDrumCustomize] = useState(false);

  useEffect(() => {
    if (!isDrums) setShowDrumCustomize(false);
  }, [isDrums]);

// Hide advanced panels by default, but remember the user's choice.
  const [isWaveformOpen, setIsWaveformOpen] = usePersistedState(
    "ui.instrumentPage.waveformOpen",
    false
  );
      const [isRecPanelOpen, setIsRecPanelOpen] = usePersistedState(
      "ui.instrumentPage.recPanelOpen",
      true
    );

  const [trackControlsWidth, setTrackControlsWidth] = usePersistedState(
    "ui.trackControlsWidth",
    96
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
  return (
    <div className={`tone-test-page app-shell ${isDrums ? "hasDrumDock" : ""}`}>
      {/* Recordings list in upper-right */}
      <RecordingsPanel
        isOpen={isRecPanelOpen}
        onToggle={() => setIsRecPanelOpen((v) => !v)}
        recordings={recordings}
        recordingsError={recordingsError}
        storageFiles={storageFiles}
        storageError={storageError}
      />


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
      {/* Mouse mode */}
      <div className="card mouseModeCard">
        <MouseModeToggle mouseMode={mouseMode} setMouseMode={setMouseMode} />
      </div>
 
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
        isTransportPlaying={isTransportPlaying}
        addTrack={addTrack}
        deleteTrack={deleteTrack}
        renameTrack={renameTrack}
        setTrackHeightPx={setTrackHeightPx}

        trackControlsWidth={trackControlsWidth}
        setTrackControlsWidth={setTrackControlsWidth}

        DEFAULT_TRACK_HEIGHT_PX={DEFAULT_TRACK_HEIGHT_PX}
        MIN_TRACK_HEIGHT_PX={MIN_TRACK_HEIGHT_PX}
        MAX_TRACK_HEIGHT_PX={MAX_TRACK_HEIGHT_PX}

        handleTrackRecordToggle={handleTrackRecordToggle}
        handleTrackUpload={handleTrackUpload}
        activeRecordingTrackId={activeRecordingTrackId}
        mouse_interactions={mouse_interactions}
        trackCanvasRefs={trackCanvasRefs}
      />

      {/* Soundboard */}
      {isDrums ? (
        <>
        <DrumMachine
          pads={drumConfig.pads}
          activeKeyIds={activeKeyIds}
          onMouseDownKey={handleKeyMouseDown}
          onMouseEnterKey={handleKeyMouseEnter}
          getCharForPadId={drumConfig.getCharForPadId}
          showCustomize={showDrumCustomize}
          onToggleCustomize={() => setShowDrumCustomize((v) => !v)}
        />

        {showDrumCustomize ? <DrumPadCustomizer drumConfig={drumConfig} /> : null}
        </>

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
