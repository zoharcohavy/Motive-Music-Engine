import React from "react";

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
                {track.recordingDuration
                  ? `${((track.tapeHeadPos || 0) * track.recordingDuration).toFixed(
                      2
                    )}s`
                  : "0.00s"}
              </span>
            </div>

            <div
              onMouseDown={(e) => {
                if (mouseMode === "head") {
                  handleTrackStripMouseDown(track.id, e);
                }
              }}
              onMouseMove={(e) => {
                if (mouseMode === "head") {
                  handleTrackStripMouseMove(track.id, e);
                }
              }}
              draggable={mouseMode === "clips" && track.hasRecording}
onDragStart={(e) => {
  if (mouseMode !== "clips" || !track.hasRecording) return;

  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(
    "application/json",
    JSON.stringify({ fromTrackId: track.id })
  );

  // Custom drag preview: small ghost of the actual clip area
  try {
    const canvas = trackCanvasRefs.current[track.id];
    if (!canvas) return;

    const srcWidth = canvas.width;
    const srcHeight = canvas.height;
    if (!srcWidth || !srcHeight) return;

    const baseDuration = 10; // must match draw loop
    const zoom = track.zoom || 1;
    const maxDuration = baseDuration / zoom;

    const duration = track.recordingDuration || 0;
    const fraction = Math.min(1, duration / maxDuration);

    // For now, clips start at left edge (x=0)
    const clipStartX = 0;
    const clipWidthPxRaw = Math.max(4, fraction * srcWidth);

    const maxSrcWidth = srcWidth - clipStartX;
    if (maxSrcWidth <= 0) return;
    const clipWidthPx = Math.min(clipWidthPxRaw, maxSrcWidth);

    const maxPreviewWidth = 220;
    const previewHeight = 40;
    const scale = Math.min(1, maxPreviewWidth / clipWidthPx);
    const previewWidth = Math.max(20, clipWidthPx * scale);

    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    const pctx = previewCanvas.getContext("2d");

    // Dark background
    pctx.fillStyle = "#111";
    pctx.fillRect(0, 0, previewWidth, previewHeight);

    // Draw the clip region from the real canvas, scaled down
    pctx.drawImage(
      canvas,
      clipStartX,
      0,
      clipWidthPx,
      srcHeight,
      0,
      0,
      previewWidth,
      previewHeight
    );

    // Semi-transparent overlay to give a "ghost" feel
    pctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    pctx.fillRect(0, 0, previewWidth, previewHeight);

    // Bright outline
    pctx.strokeStyle = "rgba(255,255,255,0.8)";
    pctx.lineWidth = 2;
    pctx.strokeRect(1, 1, previewWidth - 2, previewHeight - 2);

    e.dataTransfer.setDragImage(
      previewCanvas,
      previewWidth / 2,
      previewHeight / 2
    );
  } catch (err) {
    console.warn("Drag ghost error:", err);
    // If anything blows up, browser falls back to default ghost
  }
}}

              onDragOver={(e) => {
                if (mouseMode !== "clips") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (mouseMode !== "clips") return;
                e.preventDefault();
                try {
                  const data = JSON.parse(
                    e.dataTransfer.getData("application/json")
                  );
                  if (
                    data &&
                    typeof data.fromTrackId === "number" &&
                    data.fromTrackId !== track.id
                  ) {
                    moveTrackRecording(data.fromTrackId, track.id);
                  }
                } catch {
                  // ignore invalid drops
                }
              }}
              style={{
                flexGrow: 1,
                height: "56px",
                borderRadius: "4px",
                border: "1px solid #555",
                backgroundColor: "#111",
                position: "relative",
                overflow: "hidden",
                cursor:
                  mouseMode === "clips" && track.hasRecording
                    ? "grab"
                    : track.hasRecording
                    ? "pointer"
                    : "default",
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
                  pointerEvents: "none",
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
