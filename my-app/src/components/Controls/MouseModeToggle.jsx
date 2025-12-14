import React from "react";

export default function MouseModeToggle({ mouseMode, setMouseMode }) {
  return (
    <div className="mouseMode">
      <span className="mouseMode__title">Mouse mode:</span>
      <label>
        <input
          type="radio"
          checked={mouseMode === "head"}
          onChange={() => setMouseMode("head")}
          className="mouseMode__radio"
        />
        Move tape head
      </label>
      <label>
        <input
          type="radio"
          checked={mouseMode === "clip"}
          onChange={() => setMouseMode("clip")}
          className="mouseMode__radio"
        />
        Move recordings between tracks
      </label>
      <label>
        <input
          type="radio"
          checked={mouseMode === "delete"}
          onChange={() => setMouseMode("delete")}
          className="mouseMode__radio"
        />
        Delete clips
      </label>
    </div>
  );
}
