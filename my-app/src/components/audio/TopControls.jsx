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
            border: "1px solid #444",
            background: roomStatus === "connected" ? "#133" : "#222",
            color: "#fff",
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
              border: "1px solid #644",
              background: isRoomRecording ? "#b22" : "#331111",
              color: "#fff",
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
            value={waveform}
            onChange={(e) => setWaveform(e.target.value)}
            style={{ padding: "0.2rem 0.4rem" }}
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
          value={effect}
          onChange={(e) => setEffect(e.target.value)}
          style={{ padding: "0.2rem 0.4rem" }}
        >
          <option value="none">No Effect</option>
          <option value="reverb">Reverb</option>
        </select>
      </div>
    </div>
  );
}
