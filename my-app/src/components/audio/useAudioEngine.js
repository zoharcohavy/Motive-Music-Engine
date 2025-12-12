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

  const sampleBuffersRef = useRef(new Map());

  const [waveform, setWaveform] = useState("sine");
  const [effect, setEffect] = useState("none");


useEffect(() => {
  let cancelled = false;

  // Ensure audio graph exists
  getAudioContext();

  const loop = () => {
    if (cancelled) return;

    const canvas = waveCanvasRef.current;
    const analyser = analyserRef.current;

    // Canvas might not be mounted yet
    if (!canvas || !analyser) {
      animationFrameRef.current = window.requestAnimationFrame(loop);
      return;
    }

    const rect = canvas.getBoundingClientRect();

    // When collapsed (display:none), rect will be 0x0 — just wait
    if (rect.width === 0 || rect.height === 0) {
      animationFrameRef.current = window.requestAnimationFrame(loop);
      return;
    }

    const canvasCtx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Keep internal resolution synced to displayed size
    const nextW = Math.floor(rect.width * dpr);
    const nextH = Math.floor(rect.height * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }

    // Reset transform each frame (avoids cumulative scaling bugs)
    canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const width = rect.width;
    const height = rect.height;

    // Clear
    canvasCtx.fillStyle = "#111";
    canvasCtx.fillRect(0, 0, width, height);

    // Stroke color by waveform
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
        strokeColor = "#66ff99";
    }

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = strokeColor;
    canvasCtx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);

      x += sliceWidth;
    }

    canvasCtx.stroke();
    animationFrameRef.current = window.requestAnimationFrame(loop);
  };

  loop();

  return () => {
    cancelled = true;
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
}, [waveform]);


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

  const playSample = async (
    sampleUrl,
    {
      source = "local",
      // You could later add per-sample gain or other options here
    } = {}
  ) => {
    if (!sampleUrl) return;

    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return;

    const buffer = await loadSample(ctx, sampleUrl);
    if (!buffer) return;

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;

    // Route through masterGain so it gets recorded like the piano
    sourceNode.connect(masterGain);
    sourceNode.start();

    // OPTIONAL: if you want to broadcast drums to the room later,
    // you could send a message here similar to playNote().
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

  const loadSample = async (ctx, url) => {
    if (!url) return null;

    // Check cache first
    const cache = sampleBuffersRef.current;
    if (cache.has(url)) {
      return cache.get(url);
    }

    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      cache.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.error("Failed to load sample:", url, err);
      return null;
    }
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
    playSample,
    playRemoteNote,
    setEffectFromRoom,
  };
}
