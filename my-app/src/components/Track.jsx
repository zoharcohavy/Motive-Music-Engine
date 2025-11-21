// src/components/Track.jsx
import React from "react";
import "./Track.css";

export default function Track({
  track,
  basePixels,
  mouseMode,
  addClip,
  setHead,
  setZoom,
  moveClip
}) {
  const stripRef = React.useRef(null);
  const pixelsPerSecond = basePixels * track.zoom;

  const handleStripClick = (e) => {
    if (mouseMode !== "moveHead") return;

    const rect = stripRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seconds = x / pixelsPerSecond;

    setHead(track.id, seconds);
  };

  const handleStopRecord = () => {
    const fakeBuffer = { duration: 2.5 }; // Replace with real AudioBuffer
    addClip(track.id, fakeBuffer, track.headTime);
  };

  const handleDragStart = (e, clip) => {
    if (mouseMode !== "moveClips") return;

    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ clipId: clip.id, fromTrack: track.id })
    );
  };

  const handleDrop = (e) => {
    if (mouseMode !== "moveClips") return;

    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    moveClip(data.clipId, data.fromTrack, track.id);
  };

  return (
    <div className="track">
      <div className="track-header">
        <button className="record-btn">● Rec</button>
        <span className="time">{track.headTime.toFixed(2)}s</span>

        <button onClick={handleStopRecord}>Stop & Save</button>

        <div className="zoom-btns">
          <button onClick={() => setZoom(track.id, -0.25)}>-</button>
          <button onClick={() => setZoom(track.id, +0.25)}>+</button>
        </div>
      </div>

      <div
        className="strip"
        ref={stripRef}
        onClick={handleStripClick}
        onDragOver={(e) => mouseMode === "moveClips" && e.preventDefault()}
        onDrop={handleDrop}
      >
        {track.clips.map(clip => {
          const left = clip.startTime * pixelsPerSecond;
          const width = clip.duration * pixelsPerSecond;
          return (
            <div
              key={clip.id}
              className="clip-box"
              draggable={mouseMode === "moveClips"}
              onDragStart={(e) => handleDragStart(e, clip)}
              style={{
                left,
                width
              }}
            >
              {clip.duration.toFixed(2)}s
            </div>
          );
        })}

        <div
          className="tape-head"
          style={{ left: track.headTime * pixelsPerSecond }}
        />
      </div>
    </div>
  );
}
