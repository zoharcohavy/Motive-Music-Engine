// src/components/audio/TopControls.jsx
import React from "react";

export default function TopControls({ waveform, setWaveform, effect, setEffect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h1 style={{ margin: "0 0 0.25rem 0" }}>Waveform Piano</h1>

      {/* Waveform selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <label>Waveform:</label>
        <select
          value={waveform}
          onChange={(e) => setWaveform(e.target.value)}
          style={{ padding: "0.2rem 0.4rem" }}
        >
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="triangle">Triangle</option>
          <option value="sawtooth">Sawtooth</option>
        </select>
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
