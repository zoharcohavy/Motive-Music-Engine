import React from "react";

const BASE_STRIP_SECONDS = 10;

const getStripSecondsForTrack = (track) => {
  const zoom = track.zoom || 1;
  return BASE_STRIP_SECONDS / zoom;
};

const getHeadSecondsForTrack = (track) => {
  const stripSeconds = getStripSecondsForTrack(track);
  const headPos =
    track.headPos != null ? track.headPos : track.tapeHeadPos || 0;
  return stripSeconds * headPos;
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
  moveTrackRecording,
  trackCanvasRefs,
}) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
          fontSize: "0.85rem",
        }}
      >
        <span>Recording Tracks</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.75rem",
              color: "#aaa",
            }}
          >
            <span>Zoom</span>
            <button
              onClick={() => changeZoom(-0.25)}
              disabled={globalZoom <= 0.25}
              style={{
                padding: "0.05rem 0.35rem",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#222",
                color: "#eee",
                cursor: globalZoom <= 0.25 ? "not-allowed" : "pointer",
              }}
            >
              −
            </button>
            <span>{globalZoom.toFixed(2)}x</span>
            <button
              onClick={() => changeZoom(0.25)}
              disabled={globalZoom >= 4}
              style={{
                padding: "0.05rem 0.35rem",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#222",
                color: "#eee",
                cursor: globalZoom >= 4 ? "not-allowed" : "pointer",
              }}
            >
              +
            </button>
          </div>

          <button
            onClick={handleGlobalPlay}
            style={{
              padding: "0.2rem 0.6rem",
              fontSize: "0.8rem",
              borderRadius: "4px",
              border: "1px solid #444",
              background: "#2a2a2a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ▶ Play Selected
          </button>
          <button
            onClick={addTrack}
            style={{
              padding: "0.2rem 0.6rem",
              fontSize: "0.8rem",
              borderRadius: "4px",
              border: "1px solid #444",
              background: "#222",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            + Add Track
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {tracks.map((track, index) => (
          <div
            key={track.id}
            onClick={() => setSelectedTrackId(track.id)}
            style={{
              borderRadius: "4px",
              border:
                selectedTrackId === track.id ? "2px solid #9cf" : "1px solid #555",
              background: "#111",
              padding: "0.3rem 0.4rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "#aaa",
                flexShrink: 0,
                width: "70px",
              }}
            >
              Track {index + 1}
            </span>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
                flexShrink: 0,
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTrackRecordToggle(track.id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid #444",
                  background:
                    activeRecordingTrackId === track.id ? "#600" : "#222",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background:
                      activeRecordingTrackId === track.id ? "#ff4444" : "#aa0000",
                  }}
                />
                {activeRecordingTrackId === track.id ? "Stop" : "Record"}
              </button>

              <span
                style={{
                fontSize: "0.7rem",
                color: "#ccc",
                minWidth: "60px",
                textAlign: "center",
                }}
              >
               {`${getHeadSecondsForTrack(track).toFixed(2)}s`}
              </span>

            </div>

                       <div
              onMouseDown={(e) => {
                handleTrackStripMouseDown(track.id, e);
              }}
              onMouseMove={(e) => {
                handleTrackStripMouseMove(track.id, e);
              }}
              style={{
                position: "relative",
                flex: 1,
                borderRadius: "4px",
                background:
                  selectedTrackId === track.id ? "#20252f" : "#121212",
                border:
                  selectedTrackId === track.id
                    ? "1px solid #4a90e2"
                    : "1px solid #333",
                overflow: "hidden",
                height: "56px",
                cursor: "pointer",
              }}
            >
              <canvas
                ref={(el) => {
                  trackCanvasRefs.current[track.id] = el;
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              />
            </div>


            <span
              style={{
                fontSize: "0.7rem",
                color: "#ccc",
                width: "50px",
                flexShrink: 0,
                textAlign: "right",
              }}
            >
              {track.recordingDuration
                ? `${track.recordingDuration.toFixed(1)}s`
                : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
