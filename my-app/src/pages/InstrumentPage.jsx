import { useEffect, useMemo, useState } from "react";
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
import { useLocation, useNavigate } from "react-router-dom";

// Sidebar images (optional). Replace / add your own later.
import PianoImg from "../assets/icons/Piano.jpg";
import DrumImg from "../assets/images/DrumImage.jpeg";
import SamplerImg from "../assets/icons/tools.svg";



export default function InstrumentPage({ instrument }) {
  const {
    waveform,
    setWaveform,
    effects,
    setEffects,
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

  // "sampler" is intentionally the same UI as drums for now.
  const isDrums = instrument === "drums" || instrument === "sampler";
  const navigate = useNavigate();
  const location = useLocation();

  const instrumentChoices = useMemo(
    () => [
      { id: "piano", label: "Synth / Piano", path: "/piano", img: PianoImg },
      { id: "drums", label: "Drums", path: "/drum", img: DrumImg },
      { id: "sampler", label: "Sampler", path: "/sampler", img: SamplerImg },
    ],
    []
  );


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
    if (instrument === "drums" || instrument === "sampler") {
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
    <div className={`tone-test-page app-shell instrumentLayout ${isDrums ? "hasDrumDock" : ""}`}>
      {/* Left instrument menu */}
      <aside className="card instrumentMenu">
        <div className="instrumentMenu__title">Instrument</div>
        <div className="instrumentMenu__grid">
          {instrumentChoices.map((c) => {
            const isActive = location.pathname === c.path;
            return (
              <button
                key={c.id}
                type="button"
                className={`instrumentMenu__btn ${isActive ? "isActive" : ""}`}
                onClick={() => navigate(c.path)}
                title={c.label}
              >
                {c.img ? (
                  <img className="instrumentMenu__img" src={c.img} alt={c.label} />
                ) : null}
                <div className="instrumentMenu__label">{c.label}</div>
              </button>
            );
          })}
        </div>

        <div className="instrumentMenu__hint">
          Tip: swap these images later (see the imports at the top of this file).
        </div>
      </aside>
      <main className="instrumentMain">
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
        effects={effects}
        setEffects={setEffects}
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

        <DrumPadCustomizer
          isOpen={showDrumCustomize}
          onClose={() => setShowDrumCustomize(false)}
          drumConfig={drumConfig}
        />
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
      </main>
    </div>
  );
}
