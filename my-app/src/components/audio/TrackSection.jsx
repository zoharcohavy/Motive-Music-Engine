import React from "react";

const BASE_STRIP_SECONDS = 10;

const getTrackLengthForTrack = (track) => {
  const zoom = track.zoom || 1;
  return BASE_STRIP_SECONDS / zoom;
};

const getHeadSecondsForTrack = (track) => {
  const trackLength = getTrackLengthForTrack(track);
  const headPos =
    track.headPos != null ? track.headPos : track.tapeHeadPos || 0;
  return trackLength * headPos;
};

export default function TrackSection({
  tracks,
  selectedTrackId,
  setSelectedTrackId,
  globalZoom,
  changeZoom,
  handleGlobalPlay,
  addTrack,
  handleTrackRecordToggle,
  activeRecordingTrackId,
  mouseMode,
  handleTrackStripMouseDown,
  handleTrackStripMouseMove,
  trackCanvasRefs,
}) {
  const hasTracks = tracks && tracks.length > 0;
  const firstTrack = hasTracks ? tracks[0] : null;
  const globalHeadPos =
    firstTrack && (firstTrack.headPos != null || firstTrack.tapeHeadPos != null)
      ? firstTrack.headPos != null
        ? firstTrack.headPos
        : firstTrack.tapeHeadPos || 0
      : 0;

  const currentTimeSeconds = firstTrack
    ? getHeadSecondsForTrack(firstTrack)
    : 0;

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* Transport / zoom row */}
      <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.75rem",
  }}
>
  <button
    type="button"
    onClick={handleGlobalPlay}
    style={{
      padding: "0.3rem 0.8rem",
      borderRadius: "4px",
      border: "1px solid #444",
      background: "#222",
      color: "#fff",
      cursor: "pointer",
    }}
  >
    ▶ Play
  </button>

  <button
    type="button"
    onClick={addTrack}
    style={{
      padding: "0.3rem 0.8rem",
      borderRadius: "4px",
      border: "1px solid #444",
      background: "#222",
      color: "#fff",
      cursor: "pointer",
    }}
  >
    + Track
  </button>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
      marginLeft: "1rem",
    }}
  >
    <span style={{ fontSize: "0.7rem", color: "#aaa" }}>Zoom</span>
    <button
      type="button"
      onClick={() => changeZoom(-0.25)}
      style={{
        padding: "0.1rem 0.4rem",
        borderRadius: "3px",
        border: "1px solid #444",
        background: "#222",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      -
    </button>
    <span style={{ fontSize: "0.75rem", minWidth: "3ch" }}>
      {globalZoom?.toFixed ? globalZoom.toFixed(2) : globalZoom}
    </span>
    <button
      type="button"
      onClick={() => changeZoom(0.25)}
      style={{
        padding: "0.1rem 0.4rem",
        borderRadius: "3px",
        border: "1px solid #444",
        background: "#222",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      +
    </button>
  </div>

  {/* Time right next to the rest, not all the way on the side */}
  <span
    style={{
      fontSize: "0.75rem",
      color: "#aaa",
      marginLeft: "0.75rem",
      minWidth: "3.5rem",
    }}
  >
    {hasTracks ? `${currentTimeSeconds.toFixed(2)}s` : "0.00s"}
  </span>
</div>


      {/* Tracks with a single global tape-head line over them */}
      <div
        style={{
          position: "relative",
          borderRadius: "6px",
          background: "#080808",
          padding: "0.5rem 0.75rem",
        }}
      >
        {/* Global tape head: one vertical line across all tracks */}
       

        {tracks.map((track) => (
          <div
            key={track.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3rem 0 0.3rem 0",
              borderTop: "1px solid #222",
              background:
        activeRecordingTrackId === track.id ? "#221111" : "transparent",
            }}
          >
            {/* Left: track controls */}
            <div
              style={{
                width: "90px",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedTrackId(track.id)}
                style={{
                  padding: "0.2rem 0.4rem",
                  fontSize: "0.7rem",
                  borderRadius: "4px",
                  border:
                    track.id === selectedTrackId
                      ? "1px solid #fff"
                      : "1px solid #555",
                  background:
                    track.id === selectedTrackId ? "#333" : "#191919",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Track {track.id + 1}
              </button>

              <button
                type="button"
                onClick={() => handleTrackRecordToggle(track.id)}
                style={{
                padding: "0.15rem 0.4rem",
                fontSize: "0.65rem",
                borderRadius: "999px",
                border: "none",
                background:
                activeRecordingTrackId === track.id ? "#d33" : "#553",
                color: "#fff",
                cursor: "pointer",
                alignSelf: "flex-start",
                }}
              >
              Rec
              </button>


              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#999",
                  flexShrink: 0,
                }}
              >
                {track.recordingDuration
                  ? `${track.recordingDuration.toFixed(1)}s`
                  : ""}
              </span>
            </div>

            {/* Right: strip canvas for this track */}
            <div
              style={{
              flex: 1,
              height: "60px",
              position: "relative",
              background: "#141414",
              borderRadius: "4px",
              overflow: "hidden",
              cursor: mouseMode === "head" ? "pointer" : "grab",
            }}
            onMouseDown={(e) => {
              setSelectedTrackId(track.id);              // arm this track
              handleTrackStripMouseDown(track.id, e);
            }}
            onMouseMove={(e) =>
              handleTrackStripMouseMove(track.id, e)
            }
            >

              <canvas
                ref={(el) => {
                  if (!trackCanvasRefs.current) {
                    trackCanvasRefs.current = {};
                  }
                  trackCanvasRefs.current[track.id] = el;
                }}
                width={800}
                height={60}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
