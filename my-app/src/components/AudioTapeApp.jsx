// src/components/AudioTapeApp.jsx
import React from "react";
import Track from "./Track";

const BASE_PIXELS_PER_SECOND = 100;

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  return seconds.toFixed(2);
}

const initialTracks = [
  { id: 1, name: "Track 1" },
  { id: 2, name: "Track 2" },
  { id: 3, name: "Track 3" },
];

export default function AudioTapeApp() {
  const [tracks, setTracks] = React.useState(
    initialTracks.map(t => ({
      ...t,
      clips: [],
      headTime: 0,
      zoom: 1,
    }))
  );

  const [mouseMode, setMouseMode] = React.useState("moveHead");

  const addClip = (trackId, buffer, startTime) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: [
                ...t.clips,
                {
                  id: crypto.randomUUID(),
                  buffer,
                  duration: buffer.duration,
                  startTime
                }
              ]
            }
          : t
      )
    );
  };

  const setHead = (trackId, newTime) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === trackId ? { ...t, headTime: newTime } : t
      )
    );
  };

  const setZoom = (trackId, delta) => {
    setTracks(prev =>
      prev.map(t =>
        t.id === trackId
          ? { ...t, zoom: Math.min(4, Math.max(0.25, t.zoom + delta)) }
          : t
      )
    );
  };

  const moveClip = (clipId, fromId, toId) => {
    let moved = null;

    const removed = tracks.map(t =>
      t.id === fromId
        ? {
            ...t,
            clips: t.clips.filter(c => {
              if (c.id === clipId) {
                moved = c;
                return false;
              }
              return true;
            })
          }
        : t
    );

    if (!moved) return;

    setTracks(
      removed.map(t =>
        t.id === toId ? { ...t, clips: [...t.clips, moved] } : t
      )
    );
  };

  return (
    <div>
      <h3>Mouse Mode</h3>
      <label>
        <input
          type="radio"
          checked={mouseMode === "moveHead"}
          onChange={() => setMouseMode("moveHead")}
        />
        Move Tape Head
      </label>
      <label>
        <input
          type="radio"
          checked={mouseMode === "moveClips"}
          onChange={() => setMouseMode("moveClips")}
        />
        Move Clips Between Tracks
      </label>

      {tracks.map(track => (
        <Track
          key={track.id}
          track={track}
          basePixels={BASE_PIXELS_PER_SECOND}
          mouseMode={mouseMode}
          addClip={addClip}
          setHead={setHead}
          setZoom={setZoom}
          moveClip={moveClip}
        />
      ))}
    </div>
  );
}
