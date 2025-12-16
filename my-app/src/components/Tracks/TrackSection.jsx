import React, { useRef } from "react";

const BASE_STRIP_SECONDS = 10;
const MIN_TIMELINE_SECONDS = 120; // 2 minutes: makes Scroll usable on page load

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
  setViewStartTimeAndSnapHead,
  headTimeSeconds,
  selectedTrackId,
  setSelectedTrackId,
  globalZoom,
  changeZoom,

  handleGlobalPlay,
  addTrack,
  deleteTrack,
  handleTrackRecordToggle,
  handleTrackUpload,
  activeRecordingTrackId,
  mouseMode,
  handleTrackStripMouseDown,
  handleTrackStripMouseMove,
  handleTrackStripContextMenu,
  trackCanvasRefs,
}) {
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
          const effectiveEnd = Math.max(baseEnd, head + visibleSeconds);

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
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`trackSection__trackRow ${
              activeRecordingTrackId === track.id ? "trackSection__trackRow--recording" : ""
            }`}
          >

            {/* Left: track controls */}
            <div className="trackSection__leftCol">
            <button
              type="button"
              onClick={() => setSelectedTrackId(track.id)}
              className={`btn trackSection__trackBtn ${
                track.id === selectedTrackId ? "trackSection__trackBtn--selected" : ""
              }`}
            >
              Track {track.id + 1}
            </button>
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

            {/* Right: strip canvas for this track */}
            <div className="trackSection__strip">

              <canvas
                ref={(el) => {
                  if (!trackCanvasRefs.current) {
                    trackCanvasRefs.current = {};
                  }
                  trackCanvasRefs.current[track.id] = el;
                }}
                width={800}
                height={40}
                className="trackSection__canvas"
                onMouseDown={(e) => handleTrackStripMouseDown?.(track.id, e)}
                onMouseMove={(e) => handleTrackStripMouseMove?.(track.id, e)}
                onContextMenu={(e) => handleTrackStripContextMenu?.(track.id, e)}


              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
