import React from "react";
import { useToneTestLogic } from "../components/audio/useToneTestLogic";
import RecordingsPanel from "../components/audio/RecordingsPanel";
import TopControls from "../components/audio/TopControls";
import MouseModeToggle from "../components/audio/MouseModeToggle";
import TrackSection from "../components/audio/TrackSection";
import PianoKeyboard from "../components/audio/PianoKeyboard";

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
    handleKeyMouseEnter,
  } = useToneTestLogic();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: "1rem 1.5rem",
        paddingBottom: "140px",
        fontFamily: "sans-serif",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Recordings list in upper-right */}
      <RecordingsPanel
        recordings={recordings}
        recordingsError={recordingsError}
      />

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
    </div>
  );
}
