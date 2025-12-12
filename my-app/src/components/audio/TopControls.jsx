// src/components/audio/TopControls.jsx
import React from "react";

export default function TopControls({
  waveform,
  setWaveform,
  effect,
  setEffect,
  roomId,
  roomStatus,
  openRoomModal,
  disconnectRoom,
  handleRoomRecordToggle,
  isRoomRecording,
  roomUsernames,
}) {
  const usersLabel =
    Array.isArray(roomUsernames) && roomUsernames.length > 0
      ? roomUsernames.join(", ")
      : "No other users yet";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
    {/* Top bar: room buttons left, room info centered */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      {/* Left: room buttons */}
      <div style={{ flex: 1, display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={
            roomStatus === "connected" ? disconnectRoom : openRoomModal
          }
          style={{
            padding: "0.2rem 0.6rem",
            borderRadius: "4px",
            border: "1px solid rgba(163, 255, 232, 0.22)",
            background: roomStatus === "connected" ? "rgba(59, 183, 168, 0.18)" : "rgba(0,0,0,0.25)",
            color: "rgba(232, 244, 242, 0.95)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          {roomStatus === "connected" ? "Leave Room" : "Connect to Room"}
        </button>

        {roomStatus === "connected" && (
          <button
            type="button"
            onClick={handleRoomRecordToggle}
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "4px",
              border: "1px solid rgba(240, 75, 90, 0.35)",
              background: isRoomRecording ? "rgba(240, 75, 90, 0.35)" : "rgba(240, 75, 90, 0.12)",
              color: "rgba(232, 244, 242, 0.95)",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            {isRoomRecording ? "⏹ Stop Room Record" : "⏺ Record Room"}
          </button>
        )}
      </div>

      {/* Center: room + usernames */}
      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: "0.85rem",
          opacity: 0.85,
        }}
      >
        {roomStatus === "connected" && roomId ? (
          <>
            Room: <strong>{roomId}</strong>
            {" · "}
            Users: {usersLabel}
          </>
        ) : (
          <span style={{ opacity: 0.7 }}>Not in a room</span>
        )}
      </div>

      {/* Right spacer */}
      <div style={{ flex: 1 }} />
    </div>

      {/* Waveform selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label>Waveform:</label>
          <select
            className="select--compact"
            value={waveform}
            onChange={(e) => setWaveform(e.target.value)}
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="triangle">Triangle</option>
          </select>
        </div>
      </div>

      {/* Effect selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <label>Effect:</label>
        <select
          className="select--compact"
          value={effect}
          onChange={(e) => setEffect(e.target.value)}
        >

          <option value="none">No Effect</option>
          <option value="reverb">Reverb</option>
        </select>
      </div>
    </div>
  );
}
