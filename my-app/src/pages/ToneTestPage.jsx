import { useRef, useState, useEffect } from "react";

const API_BASE = "http://localhost:8080";

// Generate 64 piano-style keys using equal temperament
function generateKeys() {
  const keys = [];
  const baseFreq = 130.81; // around C3
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  for (let i = 0; i < 64; i++) {
    const freq = baseFreq * Math.pow(2, i / 12);
    const octave = 3 + Math.floor(i / 12);
    const name = `${noteNames[i % 12]}${octave}`;
    keys.push({ name, freq, id: i });
  }
  return keys;
}

const KEYS = generateKeys();

// Helper: draw a generic “tape” waveform into a canvas
function drawGenericWave(ctx, width, height, intensity = 1) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(200, 200, 200, ${0.7 * intensity})`;
  ctx.beginPath();
  const steps = 300;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const t = (i / steps) * Math.PI * 4;
    const y =
      height / 2 +
      Math.sin(t) * (height * 0.25 * intensity) +
      (Math.random() - 0.5) * (height * 0.06 * intensity);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export default function ToneTestPage() {
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const masterGainRef = useRef(null);
  const convolverRef = useRef(null);
  const recordDestRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const isMouseDownRef = useRef(false);
  const animationFrameRef = useRef(null);

  const waveCanvasRef = useRef(null);

  // Per-track tape canvases
  const trackCanvasRefs = useRef({}); // { [trackId]: HTMLCanvasElement | null }

  const recordingTargetTrackIdRef = useRef(null);
  const recordStartTimeRef = useRef(null);
  const recordDurationRef = useRef(0);

  const currentAudioRef = useRef(null);
  const draggingHeadTrackIdRef = useRef(null);

  const tracksRef = useRef([]);

  const [waveform, setWaveform] = useState("sine");
  const [effect, setEffect] = useState("none"); // "none" or "reverb"
  const [recordings, setRecordings] = useState([]);
  const [recordingsError, setRecordingsError] = useState(null);

  const [tracks, setTracks] = useState([
    {
      id: 0,
      hasRecording: false,
      recordingUrl: null,
      recordingDuration: 0,
      tapeHeadPos: 0, // 0..1
      recordingImage: null,
    },
  ]);
  const [nextTrackId, setNextTrackId] = useState(1);
  const [activeRecordingTrackId, setActiveRecordingTrackId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(0);

  const activeRecordingTrackIdRef = useRef(null);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    activeRecordingTrackIdRef.current = activeRecordingTrackId;
  }, [activeRecordingTrackId]);

  // ---------- AUDIO SETUP ----------

  const setupAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);

    // Analyser for live waveform
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);

    // MediaStreamDestination for recording
    const recordDest = ctx.createMediaStreamDestination();
    masterGain.connect(recordDest);

    const mediaRecorder = new MediaRecorder(recordDest.stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordingChunksRef.current.push(e.data);
      }
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordingChunksRef.current, { type: "audio/wav" });
      recordingChunksRef.current = [];

      const targetTrackId = recordingTargetTrackIdRef.current;
      recordingTargetTrackIdRef.current = null;
      setActiveRecordingTrackId(null);

      const localUrl = URL.createObjectURL(blob);

      if (recordStartTimeRef.current) {
        recordDurationRef.current =
          (performance.now() - recordStartTimeRef.current) / 1000;
      }

      // Capture the current tape canvas for this track as an image
      let recordingImage = null;
      if (targetTrackId != null && trackCanvasRefs.current[targetTrackId]) {
        try {
          recordingImage =
            trackCanvasRefs.current[targetTrackId].toDataURL("image/png");
        } catch (e) {
          console.warn("Could not snapshot tape canvas", e);
        }
      }

      // Apply recording to the correct track
      if (targetTrackId != null) {
        const duration = recordDurationRef.current || 0;
        setTracks((prev) =>
          prev.map((track) =>
            track.id === targetTrackId
              ? {
                  ...track,
                  hasRecording: true,
                  recordingUrl: localUrl,
                  recordingDuration: duration,
                  tapeHeadPos: 0,
                  recordingImage,
                }
              : track
          )
        );
      }

      // Upload to server
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.wav");

        await fetch(`${API_BASE}/api/recordings/upload`, {
          method: "POST",
          body: formData,
        });

        fetchRecordings();
      } catch (err) {
        console.error("Upload failed:", err);
      }
    };
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    masterGainRef.current = masterGain;
    recordDestRef.current = recordDest;
    mediaRecorderRef.current = mediaRecorder;

    return ctx;
  };

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      return setupAudioContext();
    }
    return audioCtxRef.current;
  };

  const getConvolver = (ctx) => {
    if (!convolverRef.current) {
      const convolver = ctx.createConvolver();

      const length = ctx.sampleRate * 2.0; // 2 second IR
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          // decaying noise
          data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }
      }

      convolver.buffer = impulse;
      convolverRef.current = convolver;
    }
    return convolverRef.current;
  };

  // ---------- PLAYING NOTES ----------

  const playNote = (freq) => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
       if (!ctx || !masterGain) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = waveform;
    oscillator.frequency.value = freq;
    gainNode.gain.value = 0.13;

    if (effect === "reverb") {
      const convolver = getConvolver(ctx);
      oscillator.connect(gainNode);
      gainNode.connect(convolver);
      convolver.connect(masterGain);
    } else {
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
    }

    const duration = 0.5;
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  const handleKeyMouseDown = (freq) => {
    isMouseDownRef.current = true;
    playNote(freq);
  };

  const handleKeyMouseEnter = (freq) => {
    if (isMouseDownRef.current) {
      playNote(freq);
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    const trackId = draggingHeadTrackIdRef.current;
    if (trackId != null) {
      draggingHeadTrackIdRef.current = null;
      const t = tracksRef.current.find((tr) => tr.id === trackId);
      if (t && t.hasRecording && t.recordingUrl) {
        playTrackFromHead(t);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ---------- PER-TRACK TAPE HEAD & PLAYBACK ----------

  const updateTrackTapeHeadFromEvent = (trackId, evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    let pos = (evt.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, tapeHeadPos: pos } : track
      )
    );
  };

  const handleTrackStripMouseDown = (trackId, e) => {
    if (!tracksRef.current.find((t) => t.id === trackId)?.hasRecording) {
      return; // no recording yet – nothing to scrub
    }
    draggingHeadTrackIdRef.current = trackId;
    updateTrackTapeHeadFromEvent(trackId, e);
  };

  const handleTrackStripMouseMove = (trackId, e) => {
    if (draggingHeadTrackIdRef.current !== trackId) return;
    updateTrackTapeHeadFromEvent(trackId, e);
  };

  const playTrackFromHead = (track) => {
    if (!track || !track.recordingUrl) return;

    const audio = new Audio(track.recordingUrl);
    currentAudioRef.current = audio;
    const startFrac = track.tapeHeadPos || 0;

    audio.addEventListener("loadedmetadata", () => {
      try {
        audio.currentTime = startFrac * audio.duration;
      } catch {}
      audio.play().catch(() => {});
    });

    audio.play().catch(() => {});
  };

  // ---------- LIVE WAVEFORM + TAPE DRAWING LOOP ----------

  useEffect(() => {
    const draw = () => {
      const analyser = analyserRef.current;
      const waveCanvas = waveCanvasRef.current;

      // Live oscilloscope
      if (analyser && waveCanvas) {
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const wctx = waveCanvas.getContext("2d");
        const width = waveCanvas.clientWidth;
        const height = waveCanvas.clientHeight;
        waveCanvas.width = width;
        waveCanvas.height = height;

        wctx.fillStyle = "#111";
        wctx.fillRect(0, 0, width, height);

        wctx.lineWidth = 2;
        wctx.strokeStyle = "#00ff99";
        wctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            wctx.moveTo(x, y);
          } else {
            wctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        wctx.stroke();
      }

      // Draw per-track “tape” strips
      const tList = tracksRef.current;
      const now = performance.now();

      tList.forEach((track) => {
        const canvas = trackCanvasRefs.current[track.id];
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width;
        canvas.height = height;

        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, width, height);

        const isRecordingThisTrack =
          activeRecordingTrackIdRef.current === track.id &&
          recordingTargetTrackIdRef.current === track.id &&
          recordStartTimeRef.current != null;

        if (isRecordingThisTrack) {
          // tape head based on elapsed time
          const elapsedSec = (now - recordStartTimeRef.current) / 1000;
          const maxDuration = 10; // 10 seconds to fill full strip
          const headPos = Math.min(1, elapsedSec / maxDuration);
          const headX = headPos * width;

          // draw "printed" waveform behind the head using analyser data
          if (analyser) {
            const bufferLength = analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, headX, height);
            ctx.clip();

            ctx.lineWidth = 2;
            ctx.strokeStyle = "#ff9999";
            ctx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * height) / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
            ctx.stroke();
            ctx.restore();
          } else {
            drawGenericWave(ctx, headX, height, 1);
          }

          // white tape head line
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(headX, 0);
          ctx.lineTo(headX, height);
          ctx.stroke();
        } else if (track.hasRecording) {
          // draw the frozen tape image if we have one; otherwise a generic wave
          if (track.recordingImage) {
            const img = new Image();
            img.src = track.recordingImage;
            // draw immediately; dataURL should decode quickly
            try {
              ctx.drawImage(img, 0, 0, width, height);
            } catch (e) {
              drawGenericWave(ctx, width, height, 0.9);
            }
          } else {
            drawGenericWave(ctx, width, height, 0.9);
          }

          const headX = (track.tapeHeadPos || 0) * width;

          // subtle "played" region
          ctx.fillStyle = "rgba(255,255,255,0.04)";
          ctx.fillRect(0, 0, headX, height);

          // tape head line
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(headX, 0);
          ctx.lineTo(headX, height);
          ctx.stroke();
        } else {
          // no recording: subtle hatch pattern
          ctx.fillStyle = "#222";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#333";
          for (let x = -height; x < width + height; x += 8) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height, height);
            ctx.strokeStyle = "#333";
            ctx.stroke();
          }
        }
      });

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ---------- RECORDINGS LIST (SERVER) ----------

  const fetchRecordings = async () => {
    try {
      setRecordingsError(null);
      const res = await fetch(`${API_BASE}/api/recordings`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      console.log("Recordings response:", data);
      if (Array.isArray(data)) {
        setRecordings(data);
      } else if (data && Array.isArray(data.files)) {
        setRecordings(data.files);
      } else {
        setRecordings([]);
      }
    } catch (err) {
      console.error("Failed to fetch recordings:", err);
      setRecordingsError(err.message || "Unknown error");
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  // ---------- TRACK RECORDING CONTROL ----------

  const handleTrackRecordToggle = (trackId) => {
    const ctx = getAudioContext();
    if (!ctx || !mediaRecorderRef.current) return;

    // If this track is currently recording, stop
    if (recordingTargetTrackIdRef.current === trackId) {
      mediaRecorderRef.current.stop();
      return;
    }

    // If some other track is recording, ignore for now
    if (
      recordingTargetTrackIdRef.current != null &&
      recordingTargetTrackIdRef.current !== trackId
    ) {
      return;
    }

    // Start recording for this track
    recordingChunksRef.current = [];
    recordStartTimeRef.current = performance.now();
    recordDurationRef.current = 0;
    recordingTargetTrackIdRef.current = trackId;
    setActiveRecordingTrackId(trackId);
    mediaRecorderRef.current.start();
  };

  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      {
        id: nextTrackId,
        hasRecording: false,
        recordingUrl: null,
        recordingDuration: 0,
        tapeHeadPos: 0,
        recordingImage: null,
      },
    ]);
    setNextTrackId((id) => id + 1);
  };

  const handleGlobalPlay = () => {
    const t = tracksRef.current.find(
      (tr) => tr.id === selectedTrackId && tr.hasRecording && tr.recordingUrl
    );
    if (!t) return;
    playTrackFromHead(t);
  };

  // ---------- RENDER ----------

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: "1rem 1.5rem",
        paddingBottom: "140px",
        fontFamily: "sans-serif",
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Recordings list in upper-right */}
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
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Recordings</div>
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

      {/* Top controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h1 style={{ margin: "0 0 0.25rem 0" }}>Waveform Piano</h1>

        {/* Waveform selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <label>Waveform:</label>

          <select
            value={waveform}
            onChange={(e) => setWaveform(e.target.value)}
            style={{ padding: "0.2rem 0.4rem" }}
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="sawtooth">Sawtooth</option>
          </select>
        </div>

        {/* Effect selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <label>Effect:</label>
          <select
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            style={{ padding: "0.2rem 0.4rem" }}
          >
            <option value="none">No Effect</option>
            <option value="reverb">Reverb</option>
          </select>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flexGrow: 1 }} />

      {/* Live waveform visualizer */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>
          Live Waveform
        </div>
        <canvas
          ref={waveCanvasRef}
          style={{
            width: "100%",
            height: "120px",
            borderRadius: "6px",
            border: "1px solid #444",
            background: "#111",
          }}
        />
      </div>

      {/* Recording tracks with per-track tape heads */}
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
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

              <button
                onClick={() => handleTrackRecordToggle(track.id)}
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
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background:
                      activeRecordingTrackId === track.id
                        ? "#ff4444"
                        : "#aa0000",
                  }}
                />
                {activeRecordingTrackId === track.id ? "Stop" : "Record"}
              </button>

              <div
                onMouseDown={(e) => handleTrackStripMouseDown(track.id, e)}
                onMouseMove={(e) => handleTrackStripMouseMove(track.id, e)}
                style={{
                  flexGrow: 1,
                  height: "56px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#111",
                  position: "relative",
                  overflow: "hidden",
                  cursor: track.hasRecording ? "pointer" : "default",
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

      {/* Piano keyboard fixed at the bottom with white & black keys */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: "90px",
          overflowX: "hidden",
          background: "#ddd",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          {/* White keys */}
          {(() => {
            const whiteKeys = [];
            const blackKeys = [];
            let whiteIndex = 0;

            KEYS.forEach((key) => {
              if (key.name.includes("#")) {
                blackKeys.push({ ...key });
              } else {
                whiteKeys.push({ ...key, whiteIndex: whiteIndex });
                whiteIndex += 1;
              }
            });

            const totalWhites = whiteKeys.length;

            return (
              <>
                {whiteKeys.map((key) => (
                  <button
                    key={key.id}
                    onMouseDown={() => handleKeyMouseDown(key.freq)}
                    onMouseEnter={() => handleKeyMouseEnter(key.freq)}
                    style={{
                      position: "absolute",
                      left: `calc((100vw / ${totalWhites}) * ${key.whiteIndex})`,
                      width: `calc(100vw / ${totalWhites})`,
                      height: "100%",
                      borderTop: "1px solid #333",
                      borderBottom: "1px solid #333",
                      borderLeft: key.whiteIndex === 0 ? "1px solid #333" : "0",
                      borderRight: "1px solid #333",
                      background: "white",
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      paddingBottom: "0.15rem",
                      cursor: "pointer",
                      userSelect: "none",
                      fontSize: "0.5rem",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      zIndex: 1,
                    }}
                  >
                    {key.name.replace("#", "")}
                  </button>
                ))}

                {/* Black keys */}
                {(() => {
                  const whiteIndexMap = new Map();
                  let wIdx = 0;
                  KEYS.forEach((key) => {
                    if (!key.name.includes("#")) {
                      whiteIndexMap.set(key.id, wIdx);
                      wIdx += 1;
                    }
                  });

                  const blackKeys = KEYS.filter((k) => k.name.includes("#"));

                  return blackKeys.map((key) => {
                    let leftWhiteIndex = 0;
                    for (let i = key.id - 1; i >= 0; i--) {
                      if (whiteIndexMap.has(i)) {
                        leftWhiteIndex = whiteIndexMap.get(i);
                        break;
                      }
                    }
                    const offset = leftWhiteIndex + 0.7;

                    return (
                      <button
                        key={`black-${key.id}`}
                        onMouseDown={() => handleKeyMouseDown(key.freq)}
                        onMouseEnter={() => handleKeyMouseEnter(key.freq)}
                        style={{
                          position: "absolute",
                          left: `calc((100vw / ${wIdx}) * ${offset})`,
                          width: `calc(100vw / ${wIdx})`,
                          transform: "scaleX(0.6)",
                          height: "60%",
                          top: 0,
                          border: "1px solid #222",
                          background: "black",
                          color: "white",
                          boxSizing: "border-box",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          paddingBottom: "0.15rem",
                          cursor: "pointer",
                          userSelect: "none",
                          fontSize: "0.45rem",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          zIndex: 2,
                        }}
                      >
                        {key.name}
                      </button>
                    );
                  });
                })()}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
