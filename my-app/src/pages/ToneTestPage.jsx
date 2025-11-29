import React from "react";
import { useToneTestLogic } from "../components/audio/useToneTestLogic";
import RecordingsPanel from "../components/audio/RecordingsPanel";
import TopControls from "../components/audio/TopControls";
import MouseModeToggle from "../components/audio/MouseModeToggle";
import TrackSection from "../components/audio/TrackSection";
import PianoKeyboard from "../components/audio/PianoKeyboard";
import RoomModal from "../components/audio/RoomModal";


export default function ToneTestPage() {
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
    handleTrackRecordToggle,
    activeRecordingTrackId,
    handleTrackStripMouseDown,
    handleTrackStripMouseMove,
    moveTrackRecording,
    trackCanvasRefs,
    activeKeyIds,
    handleKeyMouseDown,
    handleKeyMouseEnter,roomId,
    roomStatus,
    isRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    handleRoomRecordToggle,
    isRoomRecording,
  } = useToneTestLogic();

    return (
    <div className="tone-test-page" style={{ padding: "1rem" }}>
      
      {/* Recordings list in upper-right */}
      <RecordingsPanel
        recordings={recordings}
        recordingsError={recordingsError}
      />

      {/* Room controls under recordings */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.5rem",
          fontSize: "0.8rem",
        }}
      >
        {/* Left: room label */}
        <div style={{ opacity: 0.8 }}>
          {roomStatus === "connected" && roomId ? (
            <>
              Room: <strong>{roomId}</strong>
            </>
          ) : (
            <>Not in a room</>
          )}
        </div>

        {/* Right: buttons */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={openRoomModal}
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "4px",
              border: "1px solid #444",
              background:
                roomStatus === "connected" ? "#133" : "#222",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {roomStatus === "connected" ? "Change Room" : "Connect to Room"}
          </button>

          {roomStatus === "connected" && (
            <button
              type="button"
              onClick={handleRoomRecordToggle}
              style={{
                padding: "0.2rem 0.6rem",
                borderRadius: "4px",
                border: "1px solid #644",
                background: isRoomRecording ? "#b22" : "#331111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {isRoomRecording ? "⏹ Stop Room Record" : "⏺ Record Room"}
            </button>
          )}
        </div>
      </div>


      {/* Top controls (waveform + effect) */}
      <TopControls
        waveform={waveform}
        setWaveform={setWaveform}
        effect={effect}
        setEffect={setEffect}
      />


      {/* Spacer */}
      <div style={{ flexGrow: 1 }} />

      {/* Live waveform visualizer */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>
          Live Waveform
        </div>
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

      {/* Recording tracks section */}
      <TrackSection
        tracks={tracks}
        selectedTrackId={selectedTrackId}
        setSelectedTrackId={setSelectedTrackId}
        globalZoom={globalZoom}
        changeZoom={changeZoom}
        handleGlobalPlay={handleGlobalPlay}
        addTrack={addTrack}
        handleTrackRecordToggle={handleTrackRecordToggle}
        activeRecordingTrackId={activeRecordingTrackId}
        mouseMode={mouseMode}
        handleTrackStripMouseDown={handleTrackStripMouseDown}
        handleTrackStripMouseMove={handleTrackStripMouseMove}
        moveTrackRecording={moveTrackRecording}
        trackCanvasRefs={trackCanvasRefs}
      />

      {/* Piano keyboard fixed at bottom */}
      <PianoKeyboard
        activeKeyIds={activeKeyIds}
        onMouseDownKey={handleKeyMouseDown}
        onMouseEnterKey={handleKeyMouseEnter}
      />
      <RoomModal
  isOpen={isRoomModalOpen}
  onClose={closeRoomModal}
  roomStatus={roomStatus}
  roomId={roomId}
  connectToRoom={connectToRoom}
  disconnectRoom={disconnectRoom}
/>

    </div>
  );
}
