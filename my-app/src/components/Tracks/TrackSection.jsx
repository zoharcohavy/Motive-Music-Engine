import { useRef, useState } from "react";

const BASE_STRIP_SECONDS = 10;
const MIN_TIMELINE_SECONDS = 120; // 2 minutes: makes Scroll usable on page load

const getTrackLength = (track) => {
  const zoom = track.zoom || 1;
  return BASE_STRIP_SECONDS / zoom;
};

const getHeadSecondsForTrack = (track) => {
  const trackLength = getTrackLength(track);
  const headPos =
    track.headPos != null ? track.headPos : track.tapeHeadPos || 0;
  return trackLength * headPos;
};

const getTimelineEndSeconds = (tracks) => {
  const all = tracks || [];
  let end = 0;

  for (const t of all) {
    for (const c of t.clips || []) {
      const clipEnd = (c.startTime || 0) + (c.duration || 0);
      if (clipEnd > end) end = clipEnd;
    }
  }

  // If there are no clips yet, keep the timeline at a sensible default so the
  // user can scroll immediately (without needing to record first).
  return Math.max(end, MIN_TIMELINE_SECONDS, 0);
};

const formatTimeMMSS = (seconds) => {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};



export default function TrackSection({
  tracks,
  viewStartTime,
  setViewStartTime,
  headTimeSeconds,
  selectedTrackId,
  setSelectedTrackId,
  globalZoom,
  changeZoom,

  handleGlobalPlay,
  addTrack,
  deleteTrack,
  renameTrack,
  setTrackHeightPx,

  trackControlsWidth,
  setTrackControlsWidth,

  DEFAULT_TRACK_HEIGHT_PX,
  MIN_TRACK_HEIGHT_PX,
  MAX_TRACK_HEIGHT_PX,

  handleTrackRecordToggle,
  handleTrackUpload,
  activeRecordingTrackId,
  mouse_interactions,
  trackCanvasRefs,
}) {
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");

  const controlsResizeRef = useRef(null);
  const trackResizeRef = useRef(null);

  const fileInputRefs = useRef({});
  const hasTracks = tracks && tracks.length > 0;
  const firstTrack = hasTracks ? tracks[0] : null;
  const currentTimeSeconds =
    typeof headTimeSeconds === "number"
      ? headTimeSeconds
      : firstTrack
      ? getHeadSecondsForTrack(firstTrack)
      : 0;
  // If the playhead is offscreen, jump the viewport so the head is visible.
  // Place it slightly to the right of the left edge.
  const revealHeadIfOffscreen = () => {
    if (!hasTracks) return;
    if (typeof setViewStartTime !== "function") return;

    // visible window size
    const zoom = globalZoom || (firstTrack?.zoom || 1);
    const visibleSeconds = BASE_STRIP_SECONDS / (zoom || 1);

    // ✅ Use ABSOLUTE head time (this is the important fix)
    const head = Number.isFinite(headTimeSeconds) ? headTimeSeconds : 0;

    const viewStart = Number.isFinite(viewStartTime) ? viewStartTime : 0;
    const viewEnd = viewStart + visibleSeconds;

    // If head is already visible, do nothing
    if (head >= viewStart && head <= viewEnd) return;

    // Put head slightly to the right of the left edge
    const padding = visibleSeconds * 0.12;
    const nextStart = Math.max(0, head - padding);

    // ✅ One-shot jump (not incremental)
    setViewStartTime(nextStart);
  };
  const revealThen = (fn) => {
    revealHeadIfOffscreen();
    // Let React apply the viewStartTime update before starting transport/recording.
    window.requestAnimationFrame(() => fn());
  };


  const zoom = globalZoom || (firstTrack?.zoom || 1);
  const visibleSeconds = BASE_STRIP_SECONDS / (zoom || 1);

  // percent across the visible window (0..1)
  const head = Number.isFinite(headTimeSeconds) ? headTimeSeconds : 0;
  const start = Number.isFinite(viewStartTime) ? viewStartTime : 0;
  const frac = visibleSeconds > 0 ? (head - start) / visibleSeconds : 0;

  // allow it to go slightly offscreen without exploding layout
  const clamped = Math.max(-0.1, Math.min(1.1, frac));
  const headLeftPercent = clamped * 100;


  const beginResizeControls = (e) => {
    e.preventDefault();
    e.stopPropagation();
    controlsResizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startW: trackControlsWidth || 96,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onResizeControlsMove = (e) => {
    if (!controlsResizeRef.current) return;
    const dx = e.clientX - controlsResizeRef.current.startX;
    const next = controlsResizeRef.current.startW + dx;
    setTrackControlsWidth(Math.max(40, Math.min(420, Math.round(next))));
  };

  const endResizeControls = (e) => {
    if (!controlsResizeRef.current) return;
    controlsResizeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const beginResizeTrackHeight = (trackId, currentHeight, e) => {
    e.preventDefault();
    e.stopPropagation();
    trackResizeRef.current = {
      trackId,
      pointerId: e.pointerId,
      startY: e.clientY,
      startH: currentHeight,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };

  const onResizeTrackHeightMove = (e) => {
    if (!trackResizeRef.current) return;
    const dy = e.clientY - trackResizeRef.current.startY;
    const next = trackResizeRef.current.startH + dy;
    setTrackHeightPx(trackResizeRef.current.trackId, next);
  };

  const endResizeTrackHeight = (e) => {
    if (!trackResizeRef.current) return;
    trackResizeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  const startRename = (track) => {
    setEditingTrackId(track.id);
    setNameDraft(track.name?.trim() ? track.name : String(track.id + 1));
  };

  const commitRename = (track) => {
    renameTrack?.(track.id, nameDraft);
    setEditingTrackId(null);
  };

  return (
    <div className="trackSection">
      {/* Transport / zoom row */}
    <div className="trackSection__transportRow">

  <button
    className="btn btn-primary"
    onClick={() => revealThen(handleGlobalPlay)}
  >
    ▶ Play
  </button>

<button className="btn" onClick={addTrack}>
    + Track
  </button>

  <div className="trackSection__zoomGroup">

    <span className="trackSection__hint">Zoom</span>
    <button
      type="button"
      className="btn trackSection__zoomBtn"
      onClick={() => changeZoom(-0.25)}
    >
      -
    </button>

    <span className="trackSection__zoomValue">
      {globalZoom?.toFixed ? globalZoom.toFixed(2) : globalZoom}
    </span>
    <button
      type="button"
      className="btn trackSection__zoomBtn"
      onClick={() => changeZoom(0.25)}
    >
      +
    </button>

  </div>
  {/* Global horizontal scroll (pans ALL tracks) */}
  {typeof viewStartTime === "number" && typeof setViewStartTime === "function" && (
    <div className="trackSection__scrollRow">
      <span className="trackSection__hint">Scroll</span>


      <input
        type="range"
        min={0}
        max={(() => {
          const zoom = globalZoom || 1;
          const visibleSeconds = BASE_STRIP_SECONDS / zoom;

          const baseEnd = getTimelineEndSeconds(tracks);

          // ✅ make sure scroll range includes where the tapehead currently is
          const head = Number.isFinite(headTimeSeconds) ? headTimeSeconds : 0;
          // Chunked timeline growth:
          // currentEnd snaps to a 2-minute boundary (min 2:00)
          const CHUNK = 120; // 2 minutes
          const BUFFER = 10; // grow when within last 10s

          const snappedEnd = Math.max(CHUNK, Math.ceil(Math.max(baseEnd, head) / CHUNK) * CHUNK);

          // If head is within the last 10s of the current chunk, grow by +2 minutes
          const effectiveEnd = head >= snappedEnd - BUFFER ? snappedEnd + CHUNK : snappedEnd;


          return Math.max(0, effectiveEnd - visibleSeconds);
        })()}
        step={0.01}
        value={Math.max(0, viewStartTime)}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setViewStartTime(v); // scroll only; do NOT move the tapehead
        }}

        className="trackSection__scrollSlider"
        aria-label="Scroll timeline"
      />
    </div>
  )}

  {/* Time right next to the rest, not all the way on the side */}
  <span className="trackSection__time">
    {formatTimeMMSS(hasTracks ? currentTimeSeconds : 0)}
  </span>
</div>


      {/* Tracks with a single global tape-head line over them */}
      <div className="trackSection__tracksWrap">
        {/* Global tape head: one vertical line across all tracks */}
        {tracks.map((track) => {
          const trackHeightPx = track.heightPx ?? DEFAULT_TRACK_HEIGHT_PX;

          return (
            <div
              key={track.id}
              className={`trackSection__trackRow ${
                activeRecordingTrackId === track.id ? "trackSection__trackRow--recording" : ""
              }`}
              style={{ height: trackHeightPx }}
            >


            {/* Left: track controls */}
            <div className="trackSection__leftCol" style={{ width: trackControlsWidth }}>
              {editingTrackId === track.id ? (
                <input
                  className="trackSection__trackNameInput"
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => commitRename(track)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(track);
                    if (e.key === "Escape") setEditingTrackId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedTrackId(track.id)}
                  onDoubleClick={() => startRename(track)}
                  className={`btn trackSection__trackBtn ${
                    track.id === selectedTrackId ? "trackSection__trackBtn--selected" : ""
                  }`}
                  title="Double-click to rename"
                >
                  {track.name?.trim() ? track.name : String(track.id + 1)}
                </button>
              )}

              <button
                type="button"
                onClick={() => revealThen(() => handleTrackRecordToggle(track.id))}
                className={`btn trackSection__recBtn ${
                  activeRecordingTrackId === track.id ? "trackSection__recBtn--active" : ""
                }`}
              >
                Rec
              </button>
              <button
                type="button"
                className="btn trackSection__uploadBtn"
                onClick={() => fileInputRefs.current[track.id]?.click()}
                title="Add an audio file clip to this track"
              >
                +Audio
              </button>
              <button
                type="button"
                className="btn trackSection__deleteBtn"
                onClick={() => deleteTrack(track.id)}
                title="Delete track"
              >
                ✕
              </button>


              <input
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                ref={(el) => {
                  if (!fileInputRefs.current) fileInputRefs.current = {};
                  if (el) fileInputRefs.current[track.id] = el;
                }}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f && typeof handleTrackUpload === "function") {
                    handleTrackUpload(track.id, f);
                  }
                  e.target.value = "";
                }}
              />




              <span className="trackSection__recTime">

                {track.recordingDuration
                  ? `${track.recordingDuration.toFixed(1)}s`
                  : ""}
              </span>
            </div>

            <div
              className="trackSection__controlsResizeHandle"
              onPointerDown={beginResizeControls}
              onPointerMove={onResizeControlsMove}
              onPointerUp={endResizeControls}
              onPointerCancel={endResizeControls}
            />


            {/* Right: strip canvas for this track */}
            <div className="trackSection__strip" style={{ height: trackHeightPx }}>

              <canvas
                ref={(el) => {
                  if (!trackCanvasRefs.current) {
                    trackCanvasRefs.current = {};
                  }
                  trackCanvasRefs.current[track.id] = el;
                }}
                width={800}
                height={trackHeightPx}
                className="trackSection__canvas"
                style={{ touchAction: "none", height: trackHeightPx }}
                onPointerDown={(e) => mouse_interactions?.onPointerDown?.(track.id, e)}
                onPointerMove={(e) => mouse_interactions?.onPointerMove?.(track.id, e)}
                onPointerUp={(e) => mouse_interactions?.onPointerUp?.(track.id, e)}
                onPointerCancel={(e) => mouse_interactions?.onPointerCancel?.(track.id, e)}
                onContextMenu={(e) => mouse_interactions?.onContextMenu?.(track.id, e)}
              />
              <div
                className="trackSection__trackResizeHandle"
                onPointerDown={(e) => beginResizeTrackHeight(track.id, trackHeightPx, e)}
                onPointerMove={onResizeTrackHeightMove}
                onPointerUp={endResizeTrackHeight}
                onPointerCancel={endResizeTrackHeight}
                title="Drag to resize track height"
              />

            </div>
          </div>
        );
      })}

      </div>
    </div>
  );
}
