import React from "react";
import { API_BASE } from "../../components/audio/constants";

export default function RecordingsPanel({ recordings, recordingsError }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "1rem",
        right: "1.5rem",
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        padding: "0.75rem 1rem",
        borderRadius: "6px",
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
