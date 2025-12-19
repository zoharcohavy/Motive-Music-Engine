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
  const overdriveWorkletReadyRef = useRef(null);


  const [waveform, setWaveform] = useState("sine");
  const [effects, setEffects] = useState([]); // [{ type: "reverb" } | { type: "overdrive", drive: 2, mix: 1 }]

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

  // Lazily create + cache an impulse response buffer for reverb
  const getReverbImpulse = (ctx) => {
    if (convolverRef.current && convolverRef.current.__impulse) {
      return convolverRef.current.__impulse;
    }

    const length = ctx.sampleRate * 2; // ~2s IR
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    // Store on convolverRef as a convenient cache container
    if (!convolverRef.current) convolverRef.current = {};
    convolverRef.current.__impulse = impulse;
    return impulse;
  };

  const createReverbNode = (ctx) => {
    const convolver = ctx.createConvolver();
    convolver.buffer = getReverbImpulse(ctx);
    return convolver;
  };

  // Ensure AudioWorklet modules are loaded once
  const ensureOverdriveWorklet = async (ctx) => {
    if (!ctx?.audioWorklet) return;
    if (!overdriveWorkletReadyRef.current) {
      overdriveWorkletReadyRef.current = ctx.audioWorklet
        .addModule("/audio-worklets/overdrive-processor.js")
        .catch((err) => {
          console.warn("[audio] Failed to load overdrive worklet:", err);
          overdriveWorkletReadyRef.current = null;
        });
    }
    return overdriveWorkletReadyRef.current;
  };

  const createOverdriveNode = async (ctx, params = {}) => {
    await ensureOverdriveWorklet(ctx);
    if (!ctx?.audioWorklet) return null;

    try {
      const node = new AudioWorkletNode(ctx, "overdrive-processor");
      const driveParam = node.parameters.get("drive");
      const mixParam = node.parameters.get("mix");

      if (driveParam) driveParam.setValueAtTime(params.drive ?? 2, ctx.currentTime);
      if (mixParam) mixParam.setValueAtTime(params.mix ?? 1, ctx.currentTime);

      return node;
    } catch (e) {
      console.warn("[audio] Failed to create overdrive node:", e);
      return null;
    }
  };


  const playNote = async (
    freq,
    {
      source = "local",
      waveformOverride,
      effectsOverride,
    } = {}
  ) => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return;

    const oscWaveform = waveformOverride || waveform;
    const fxChainRaw = effectsOverride ?? effects;
    const fxChain = Array.isArray(fxChainRaw)
      ? fxChainRaw
      : fxChainRaw
      ? [{ type: String(fxChainRaw) }] // backward compatible with old "effect" string
      : [];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = oscWaveform;
    oscillator.frequency.value = freq;
    gainNode.gain.value = 0.13;

    // Build a per-note FX chain (max 5)
    oscillator.connect(gainNode);

    let last = gainNode;

    const limitedChain = fxChain.slice(0, 5);
    for (const fx of limitedChain) {
      const type = typeof fx === "string" ? fx : fx?.type;

      if (!type || type === "none") continue;

      if (type === "reverb") {
        const reverb = createReverbNode(ctx);
        last.connect(reverb);
        last = reverb;
        continue;
      }

      if (type === "overdrive") {
        // eslint-disable-next-line no-await-in-loop
        const od = await createOverdriveNode(ctx, {
          drive: fx?.drive,
          mix: fx?.mix,
        });
        if (od) {
          last.connect(od);
          last = od;
        }
        continue;
      }
    }

    last.connect(masterGain);

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
        effects: limitedChain,
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
    { waveform: remoteWaveform, effects: remoteEffects, effect: remoteEffect } = {}
  ) => {
    playNote(freq, {
      source: "remote",
      waveformOverride: remoteWaveform,
      effectsOverride: remoteEffects ?? remoteEffect, // supports old string too
    });
  };

  const setEffectFromRoom = (roomEffects) => {
    // Accept either old string 'effect' or new effects array
    if (Array.isArray(roomEffects)) setEffects(roomEffects);
    else if (roomEffects) setEffects([{ type: String(roomEffects) }]);
    else setEffects([]);
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
    effects,
    setEffects,


    // low-level helpers
    getAudioContext,

    // actions
    playNote,
    playSample,
    playRemoteNote,
    setEffectFromRoom,
  };
}
