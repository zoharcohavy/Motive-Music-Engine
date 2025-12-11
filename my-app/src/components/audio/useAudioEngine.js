// src/components/audio/useAudioEngine.js
import { useRef, useState, useEffect } from "react";

export function useAudioEngine(options = {}) {
  const { roomStatus, sendRoomMessage } = options;

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const masterGainRef = useRef(null);
  const convolverRef = useRef(null);
  const recordDestRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const waveCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [waveform, setWaveform] = useState("sine");
  const [effect, setEffect] = useState("none");


  useEffect(() => {
    // Make sure we have an AudioContext + analyser
    const ctx = getAudioContext(); // this will lazily create the context & analyser
    const canvas = waveCanvasRef.current;
    const analyser = analyserRef.current;
    if (!ctx || !canvas || !analyser) return;

    const canvasCtx = canvas.getContext("2d");
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    // Optional: ensure canvas internal size matches CSS size for sharper drawing
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvasCtx.scale(dpr, dpr);

    const draw = () => {
      const width = rect.width;
      const height = rect.height;
      analyser.getByteTimeDomainData(dataArray);
      // Clear background
      canvasCtx.fillStyle = "#111";
      canvasCtx.fillRect(0, 0, width, height);

      // Choose color based on waveform type so you can visually see square vs sine, etc.
      let strokeColor = "#66ff99";
      switch (waveform) {
        case "square":
          strokeColor = "#ffcc00";
          break;
        case "triangle":
          strokeColor = "#00ccff";
          break;
        case "sawtooth":
          strokeColor = "#ff66cc";
          break;
        default:
          strokeColor = "#66ff99"; // sine / anything else
      }
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = strokeColor;
      canvasCtx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0–255 → around 0–2
        const y = (v * height) / 2;     // center around midline

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasCtx.stroke();
      animationFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
        if (animationFrameRef.current) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };
  }, [waveform]); // re-run if waveform type changes


  // Lazily create and wire up the AudioContext + analyser + masterGain
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
      masterGain.connect(analyser);
      masterGainRef.current = masterGain;
    }
    return audioCtxRef.current;
  };

  // Lazily create a simple reverb convolver
  const getConvolver = (ctx) => {
    if (!convolverRef.current) {
      const convolver = ctx.createConvolver();
      const length = ctx.sampleRate * 2; // ~2s IR
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

      for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
        const channelData = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          // noise that decays over time
          const decay = Math.pow(1 - i / length, 2);
          channelData[i] = (Math.random() * 2 - 1) * decay;
        }
      }

      convolver.buffer = impulse;
      convolverRef.current = convolver;
    }
    return convolverRef.current;
  };

  const playNote = (
    freq,
    {
      source = "local",
      waveformOverride,
      effectOverride,
    } = {}
  ) => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return;

    const oscWaveform = waveformOverride || waveform;
    const fx = effectOverride || effect;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = oscWaveform;
    oscillator.frequency.value = freq;
    gainNode.gain.value = 0.13;

    if (fx === "reverb") {
      const convolver = getConvolver(ctx);
      oscillator.connect(gainNode);
      gainNode.connect(convolver);
      convolver.connect(masterGain);
    } else {
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);
    }

    oscillator.start();
    oscillator.stop(ctx.currentTime + 1.5);

    // Broadcast to room if this is a local note and we're connected
    if (
      source === "local" &&
      roomStatus === "connected" &&
      typeof sendRoomMessage === "function"
    ) {
      console.log("[room] sending note", freq);
      sendRoomMessage({
        type: "note",
        freq,
        waveform: oscWaveform,
        effect: fx,
      });
    }
  };

  // Play a note coming from a remote user
  const playRemoteNote = (
    freq,
    { waveform: remoteWaveform, effect: remoteEffect } = {}
  ) => {
    playNote(freq, {
      source: "remote",
      waveformOverride: remoteWaveform,
      effectOverride: remoteEffect,
    });
  };

  // Let the room change our effect (if you wire that in)
  const setEffectFromRoom = (roomEffect) => {
    setEffect(roomEffect);
  };

  return {
    // refs
    audioCtxRef,
    analyserRef,
    masterGainRef,
    convolverRef,
    recordDestRef,
    mediaRecorderRef,
    recordingChunksRef,
    waveCanvasRef,

    // state
    waveform,
    setWaveform,
    effect,
    setEffect,

    // low-level helpers
    getAudioContext,
    getConvolver,

    // actions
    playNote,
    playRemoteNote,
    setEffectFromRoom,
  };
}
