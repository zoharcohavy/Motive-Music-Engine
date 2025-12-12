import React from "react";

export default function MouseModeToggle({ mouseMode, setMouseMode }) {
  return (
    <div
      style={{
        marginTop: "0.5rem",
        marginBottom: "0.25rem",
        fontSize: "0.8rem",
        color: "#000000ff",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <span style={{ fontWeight: 500 }}>Mouse mode:</span>
      <label>
        <input
          type="radio"
          checked={mouseMode === "head"}
          onChange={() => setMouseMode("head")}
          style={{ marginRight: "0.25rem" }}
        />
        Move tape head
      </label>
      <label>
        <input
          type="radio"
          checked={mouseMode === "clip"}
          onChange={() => setMouseMode("clip")}
          style={{ marginRight: "0.25rem" }}
        />
        Move recordings between tracks
      </label>
      <label>
        <input
          type="radio"
          checked={mouseMode === "delete"}
          onChange={() => setMouseMode("delete")}
          style={{ marginRight: "0.25rem" }}
        />
        Delete clips
      </label>
    </div>
  );
}
