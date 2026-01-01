import { useEffect, useMemo, useState } from "react";
import { useInstrumentPageLogic } from "../components/audio/useInstrumentPageLogic";
import RecordingsPanel from "../components/audio/Engines/RecordingsPanel";
import TopControls from "../components/Controls/TopControls";
import MouseModeToggle from "../components/Controls/MouseModeToggle";
import TrackSection from "../components/Tracks/TrackSection";
import RoomModal from "../components/Rooms/RoomModal";
import TrackFxModal from "../components/Controls/TrackFxModal";
import { getDefaultDrumAnchors } from "../components/audio/SoundBoards/DrumLayoutDefaults";
import PianoKeyboard from "../components/audio/SoundBoards/PianoKeyboard";
import DrumMachine from "../components/audio/SoundBoards/DrumMachine";

import { KEYS, getKeyIndexForKeyboardChar } from "../components/audio/constants";
import { useInstrumentHotkeys } from "../components/audio/SoundBoards/useInstrumentHotkeys";
import { useDrumPadConfig } from "../components/audio/SoundBoards/useDrumPadConfig";
import { usePersistedState } from "../components/ui/usePersistedState";
import DrumPadCustomizer from "../components/audio/SoundBoards/DrumPadCustomizer";
import { useLocation, useNavigate } from "react-router-dom";

// Sidebar images (optional). Replace / add your own later.
import PianoImg from "../assets/icons/Piano.jpg";
import DrumImg from "../assets/images/DrumImage.jpeg";
import SamplerImg from "../assets/icons/tools.svg";
import SineWaveIcon from "../assets/icons/sine-wave.svg";
import AppModal from "../components/ui/AppModal";




export default function InstrumentPage({ instrument }) {
  const {
    waveform,
    setWaveform,
    recordings,
    recordingsError,
    storageFiles,
    storageError,
    handleTrackUpload,
    waveCanvasRef,
    mouseMode,
    setMouseMode,

    tracks,
    setTrackEffects,
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

    toggleGlobalRecord,
    isGlobalRecording,
    recordGuard,
    clearRecordGuard,
    deleteClipsToRightOfHead,


    toggleTrackRecEnabled,
    toggleTrackMuted,
    toggleTrackSolo,
    setTrackInputDevice,
    isTransportPlaying,


    mouse_interactions,
    trackCanvasRefs,

    activeKeyIds,
    handleKeyMouseDown,
    handleKeyMouseEnter,

    roomId,
    username,
    roomStatus,
    isRoomLocked,
    roomCountdownSeconds,
    roomRecordPhase,

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
  const isDrums = instrument === "drums";
  const isSampler = instrument === "sampler";

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

  const [interfaceTrackId, setInterfaceTrackId] = useState(null);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState("");
  

  const closeInputModal = () => {
    setIsInputModalOpen(false);
    setInterfaceTrackId(null);
  };

  // IMPORTANT: to make devices like “Audient iD14” show up with labels,
  // request permission once (labels are often blank until permission is granted).
  const refreshAudioInputs = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setAudioInputs([]);
      return;
    }

    // Ask for permission (then stop immediately)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      // If denied, device IDs may still appear but labels may be blank
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      setAudioInputs(inputs);
    } catch (e) {
      setAudioInputs([]);
    }
  };

  const openInterfaceModal = async (trackId) => {
    const t = (tracks || []).find((x) => x.id === trackId);
    setSelectedInputDeviceId(t?.inputDeviceId || "");
    setInterfaceTrackId(trackId);

    await refreshAudioInputs(); // <-- this makes Audient iD14 appear reliably
    setIsInputModalOpen(true);
  };

  const applyInterfaceDevice = () => {
    if (interfaceTrackId == null) return;
    const deviceId = selectedInputDeviceId || null;
    setTrackInputDevice(interfaceTrackId, deviceId);
    setIsInputModalOpen(false);
    setInterfaceTrackId(null);
  };



  const [showDrumCustomize, setShowDrumCustomize] = useState(false);
  const [fxModalTrackId, setFxModalTrackId] = useState(null);


    // Load once on mount (also triggers permission request so labels populate)
  useEffect(() => {
    refreshAudioInputs();
  }, []);

  // If you plug/unplug the Audient while the app is open, update the dropdown
  useEffect(() => {
    if (!navigator?.mediaDevices?.addEventListener) return;

    const onChange = () => refreshAudioInputs();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, []);


  const fxTrack = useMemo(
    () => (tracks || []).find((t) => t.id === fxModalTrackId) || null,
    [tracks, fxModalTrackId]
  );

  const openFxForTrack = (trackId) => setFxModalTrackId(trackId);
  const closeFxModal = () => setFxModalTrackId(null);


  useEffect(() => {
    if (!(isDrums || isSampler)) setShowDrumCustomize(false);
  }, [isDrums, isSampler]);


// Hide advanced panels by default, but remember the user's choice.
  const [isLiveWaveformOn, setIsLiveWaveformOn] = usePersistedState(
    "ui.instrumentPage.liveWaveformOn",
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

  const [deleteClipsOnDismiss, setDeleteClipsOnDismiss] = useState(false);




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
      toggleGlobalRecord?.();
    },
    triggerChar,
  });
  // Drums-only UI prefs (persisted)
  const [drumImageScale, setDrumImageScale] = usePersistedState(
    "ui.drums.imageScale",
    1.25 // bigger by default
  );

  const [drumKeyOpacity, setDrumKeyOpacity] = usePersistedState(
    "ui.drums.keyOpacity",
    0.55
  );

  // Drums-only pad anchor layout (persisted)
  const [drumAnchors, setDrumAnchors] = usePersistedState(
    "ui.drums.anchors",
    getDefaultDrumAnchors()
  );

  const resetDrumLayout = () => {
    setDrumAnchors(getDefaultDrumAnchors());
    setDrumImageScale(1.25);
    setDrumKeyOpacity(0.55);
  };

  // Sampler-only UI prefs (persisted)
  const [samplerImageScale, setSamplerImageScale] = usePersistedState(
    "ui.sampler.imageScale",
    1.0
  );

  const [samplerKeyOpacity, setSamplerKeyOpacity] = usePersistedState(
    "ui.sampler.keyOpacity",
    0.9
  );

  const resetSamplerLayout = () => {
    setSamplerImageScale(1.0);
    setSamplerKeyOpacity(0.9);
  };

  return (
    <div
      className={`tone-test-page app-shell instrumentLayout ${
        isDrums ? "hasDrumDock" : ""
      } ${isRoomLocked ? "roomLocked" : ""}`}
    >
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
      <div className="instrumentMain__inner">
        {/* Mouse mode + Live Waveform ribbon + monitor (monitor docks to the right without shifting buttons) */}
        <div className="mouseModeRow">
        <div className="mouseModeDock">
            <div className="card mouseModeCard">
            <MouseModeToggle mouseMode={mouseMode} setMouseMode={setMouseMode} />
            </div>

            {/* Live waveform ribbon */}
            <button
            type="button"
            className={`liveWaveRibbon ${isLiveWaveformOn ? "active" : ""}`}
            onClick={() => setIsLiveWaveformOn((v) => !v)}
            aria-pressed={isLiveWaveformOn}
            title="Live waveform"
            >
            <img
                src={SineWaveIcon}
                alt=""
                draggable={false}
                className="liveWaveRibbon__icon"
            />
            <span className="liveWaveRibbon__text">Live</span>
            </button>

            {isLiveWaveformOn && (
            <div className="card liveWaveCard liveWaveCard--docked">
                <canvas ref={waveCanvasRef} className="wave-canvas" />
            </div>
            )}
        </div>
        {/* Top controls */}
        <TopControls
        waveform={waveform}
        setWaveform={setWaveform}
        showWaveform={false}
        roomId={roomId}
        roomStatus={roomStatus}
        openRoomModal={openRoomModal}
        disconnectRoom={disconnectRoom}
        handleRoomRecordToggle={handleRoomRecordToggle}
        isRoomRecording={isRoomRecording}
        roomUsernames={roomUsernames}
        roomCountdownSeconds={roomCountdownSeconds}
        roomRecordPhase={roomRecordPhase}
        />
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

        onToggleGlobalRecord={toggleGlobalRecord}
        isGlobalRecording={isGlobalRecording}
        

        toggleTrackRecEnabled={toggleTrackRecEnabled}
        toggleTrackMuted={toggleTrackMuted}
        toggleTrackSolo={toggleTrackSolo}
        onOpenInterface={openInterfaceModal}


        handleTrackUpload={handleTrackUpload}
        mouse_interactions={mouse_interactions}
        trackCanvasRefs={trackCanvasRefs}
        onOpenFx={openFxForTrack}
        />

        {/* Soundboard */}
        <div className="roomAllowedInstrument">
        {isDrums ? (
            <>
            <DrumMachine
                layout="kit"
                drumImageScale={drumImageScale}
                drumKeyOpacity={drumKeyOpacity}
                drumAnchors={drumAnchors}
                setDrumAnchors={setDrumAnchors}
                pads={drumConfig.pads}
                activeKeyIds={activeKeyIds}
                onMouseDownKey={handleKeyMouseDown}
                onMouseEnterKey={handleKeyMouseEnter}
                getCharForPadId={drumConfig.getCharForPadId}
                showCustomize={showDrumCustomize}
                onToggleCustomize={() => setShowDrumCustomize((v) => !v)}
            />
            </>
        ) : isSampler ? (
            <>
            <DrumMachine
                layout="grid"
                drumImageScale={samplerImageScale}
                drumKeyOpacity={samplerKeyOpacity}
                pads={drumConfig.pads}
                activeKeyIds={activeKeyIds}
                onMouseDownKey={handleKeyMouseDown}
                onMouseEnterKey={handleKeyMouseEnter}
                getCharForPadId={drumConfig.getCharForPadId}
                showCustomize={showDrumCustomize}
                onToggleCustomize={() => setShowDrumCustomize((v) => !v)}
            />
            </>
        ) : (
            <PianoKeyboard
            waveform={waveform}
            setWaveform={setWaveform}
            activeKeyIds={activeKeyIds}
            onMouseDownKey={handleKeyMouseDown}
            onMouseEnterKey={handleKeyMouseEnter}
            />
        )}
        </div>

        {(isDrums || isSampler) && (
        <DrumPadCustomizer
            isOpen={showDrumCustomize}
            onClose={() => setShowDrumCustomize(false)}
            drumConfig={drumConfig}

            drumImageScale={isDrums ? drumImageScale : samplerImageScale}
            setDrumImageScale={isDrums ? setDrumImageScale : setSamplerImageScale}

            drumKeyOpacity={isDrums ? drumKeyOpacity : samplerKeyOpacity}
            setDrumKeyOpacity={isDrums ? setDrumKeyOpacity : setSamplerKeyOpacity}

            onResetLayout={isDrums ? resetDrumLayout : resetSamplerLayout}
        />
        )}

        <AppModal
        isOpen={!!recordGuard}
        title="Recording blocked"
        onClose={() => {
            if (deleteClipsOnDismiss) deleteClipsToRightOfHead?.();
            setDeleteClipsOnDismiss(false);
            clearRecordGuard?.();
        }}
        onEnter={() => {
            if (deleteClipsOnDismiss) deleteClipsToRightOfHead?.();
            setDeleteClipsOnDismiss(false);
            clearRecordGuard?.();
        }}
        >
        {recordGuard?.mode === "room" ? (
            <>
            <p className="appModal__small">
                Room recording is blocked. Some users have record-armed tracks that need clearing.
            </p>

            <div style={{ marginTop: 10 }}>
                {(recordGuard?.offenders || []).map((o) => (
                <div key={o.username} className="appModal__small" style={{ marginBottom: 6 }}>
                    <strong>{o.username}</strong>:{" "}
                    {`${o.tracksNeedingClear} track${o.tracksNeedingClear === 1 ? "" : "s"} (${o.clipCount} clip${
                    o.clipCount === 1 ? "" : "s"
                    })`}
                </div>
                ))}
            </div>

            <p className="appModal__small" style={{ marginTop: 10 }}>
                You can only delete <strong>your</strong> clips. Other users must clear theirs on their own.
            </p>
            </>
        ) : recordGuard?.mode === "ready" ? (
            <p className="appModal__small">make sure all users are ready</p>
        ) : (
            <p className="appModal__small">
            You have {recordGuard?.clipCount || 0} clip{(recordGuard?.clipCount || 0) === 1 ? "" : "s"} to
            the right of the tape-head. Recording is disabled to prevent overwriting existing audio.
            </p>
        )}


        {recordGuard?.mode === "room" ? (
        (recordGuard?.offenders || []).some((o) => o.username === username) ? (
            <label className="appModal__checkboxRow">
            <input
                type="checkbox"
                checked={deleteClipsOnDismiss}
                onChange={(e) => setDeleteClipsOnDismiss(e.target.checked)}
            />
            <span className="appModal__small">
                Delete clips to the right of the tape-head when closing this popup
            </span>
            </label>
        ) : null
        ) : recordGuard?.mode !== "ready" ? (
        <label className="appModal__checkboxRow">
            <input
            type="checkbox"
            checked={deleteClipsOnDismiss}
            onChange={(e) => setDeleteClipsOnDismiss(e.target.checked)}
            />
            <span className="appModal__small">
            Delete clips to the right of the tape-head when closing this popup
            </span>
        </label>
        ) : null}

        <div className="appModal__footer" style={{ padding: 0, marginTop: "0.9rem" }}>
            <button
            type="button"
            className="appModal__btn"
            onClick={() => {
                if (deleteClipsOnDismiss) deleteClipsToRightOfHead?.();
                setDeleteClipsOnDismiss(false);
                clearRecordGuard?.();
            }}
            >
            Close
            </button>
        </div>
        </AppModal>

        {/* Modals */}
        <TrackFxModal
        isOpen={fxModalTrackId != null}
        onClose={closeFxModal}
        trackName={fxTrack?.name}
        effects={fxTrack?.effects || []}
        onChangeEffects={(next) => {
            if (fxModalTrackId == null) return;
            setTrackEffects?.(fxModalTrackId, next);
        }}
        />
        {/* Input modal */}
        {isInputModalOpen && (
        <div className="fxModal__overlay" onMouseDown={closeInputModal}>
            <div className="fxModal__panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fxModal__header">
                <div className="fxModal__title">Interface (This Track)</div>
                <button className="btn" onClick={closeInputModal} type="button">
                Close
                </button>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ minWidth: 80 }}>Device</label>
                <select
                value={selectedInputDeviceId}
                onChange={(e) => setSelectedInputDeviceId(e.target.value)}
                >
                <option value="">(Disconnected)</option>
                {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Input ${d.deviceId.slice(0, 6)}...`}
                    </option>
                ))}
                </select>
                <button className="btn btn-primary" onClick={applyInterfaceDevice} type="button">
                Apply
                </button>

            </div>
            <p style={{ marginTop: 10, opacity: 0.85 }}>
                Once connected, you should hear the selected input routed through the selected track&apos;s effects.
            </p>
            </div>
        </div>
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
      </main>
    </div>
  );
}
