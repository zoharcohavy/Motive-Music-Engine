import React from "react";
import { API_BASE } from "../constants";

export default function RecordingsPanel({ recordings, recordingsError }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        right: "1.5rem",
        background: "rgba(6, 24, 28, 0.85)",
        borderRadius: "14px",
        border: "1px solid rgba(163, 255, 232, 0.12)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        color: "#fff",
        padding: "0.75rem 1rem",
        maxWidth: "260px",
        maxHeight: "40vh",
        overflowY: "auto",
        fontSize: "0.8rem",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
        Recordings
      </div>
      {recordingsError ? (
        <div style={{ fontStyle: "italic", color: "#f88" }}>
          Error loading recordings: {recordingsError}
        </div>
      ) : recordings.length === 0 ? (
        <div style={{ fontStyle: "italic" }}>No recordings yet</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {recordings.map((file) => (
            <li key={file} style={{ marginBottom: "0.25rem" }}>
              <a
                href={`${API_BASE}/recordings/${file}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#9cf", textDecoration: "none" }}
              >
                {file}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
