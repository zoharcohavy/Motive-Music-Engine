// src/pages/ToneTestPage.jsx
import { useRef, useState, useEffect } from "react";

// Vintage waveform images
import sineImg from "../assets/waves/sine.png";
import squareImg from "../assets/waves/square.png";
import triangleImg from "../assets/waves/triangle.png";
import sawImg from "../assets/waves/sawtooth.png";

const WAVE_IMAGES = {
  sine: sineImg,
  square: squareImg,
  triangle: triangleImg,
  sawtooth: sawImg,
};

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
  const recordCanvasRef = useRef(null);

  const [waveform, setWaveform] = useState("sine");
  const [effect, setEffect] = useState("none"); // "none" or "reverb"
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recordingsError, setRecordingsError] = useState(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const setupAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);

    // Analyser for waveform visualization
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

      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.wav");

        await fetch(`${API_BASE}/api/recordings/upload`, {
          method: "POST",
          body: formData,
        });

        // Refresh list after upload
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
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Waveform + recording visualization
  useEffect(() => {
    const draw = () => {
      const analyser = analyserRef.current;
      const waveCanvas = waveCanvasRef.current;
      const recordCanvas = recordCanvasRef.current;

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

      if (analyser && recordCanvas) {
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const rctx = recordCanvas.getContext("2d");
        const width = recordCanvas.clientWidth;
        const height = recordCanvas.clientHeight;
        recordCanvas.width = width;
        recordCanvas.height = height;

        // background depends on recording state
        if (isRecordingRef.current) {
          rctx.fillStyle = "#400";
        } else {
          rctx.fillStyle = "#222";
        }
        rctx.fillRect(0, 0, width, height);

        rctx.lineWidth = 2;
        rctx.strokeStyle = isRecordingRef.current ? "#ff5555" : "#888";
        rctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) {
            rctx.moveTo(x, y);
          } else {
            rctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        rctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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

  const toggleRecording = () => {
    const ctx = getAudioContext();
    if (!ctx || !mediaRecorderRef.current) return;

    if (isRecordingRef.current) {
      // stop recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      // start recording
      recordingChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: "1rem 1.5rem",
        paddingBottom: "110px",
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

        {/* Waveform + image */}
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

          <img
            src={WAVE_IMAGES[waveform]}
            alt={waveform}
            style={{
              width: "80px",
              height: "40px",
              objectFit: "contain",
              border: "1px solid #ccc",
              background: "white",
              borderRadius: "4px",
              padding: "4px",
            }}
          />
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

        <p style={{ margin: 0, maxWidth: "520px", fontSize: "0.85rem" }}>
          Choose a waveform and effect, then click a key. You can also click and hold
          and drag across the keys to hear multiple notes. Use the red record button
          to capture your performance and see saved recordings in the top-right.
        </p>
      </div>

      {/* Spacer */}
      <div style={{ flexGrow: 1 }} />

      {/* Waveform visualizer bar */}
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

      {/* Recording bar + record button */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.8rem" }}>
            Recording {isRecording ? "(ON)" : "(OFF)"}
          </span>
          <button
            onClick={toggleRecording}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.3rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid #444",
              background: isRecording ? "#600" : "#222",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: isRecording ? "#ff4444" : "#aa0000",
              }}
            />
            <span style={{ fontSize: "0.8rem" }}>
              {isRecording ? "Stop Recording" : "Record"}
            </span>
          </button>
        </div>
        <canvas
          ref={recordCanvasRef}
          style={{
            width: "100%",
            height: "80px",
            borderRadius: "6px",
            border: "1px solid #444",
            background: "#222",
          }}
        />
      </div>

      {/* Piano keyboard fixed at the bottom */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "flex-end",
          height: "90px",
          overflowX: "hidden",
          background: "#ddd",
        }}
      >
        {KEYS.map((key, index) => (
          <button
            key={key.id}
            onMouseDown={() => handleKeyMouseDown(key.freq)}
            onMouseEnter={() => handleKeyMouseEnter(key.freq)}
            style={{
              width: `calc(100vw / ${KEYS.length})`,
              minWidth: 0,
              height: "100%",
              borderTop: "1px solid #333",
              borderBottom: "1px solid #333",
              borderLeft: index === 0 ? "1px solid #333" : "0",
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
            }}
          >
            {key.name}
          </button>
        ))}
      </div>
    </div>
  );
}
