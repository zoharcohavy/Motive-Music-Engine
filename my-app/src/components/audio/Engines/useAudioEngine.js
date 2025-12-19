import { useRef, useState, useEffect } from "react";
import { createReverbNode } from "../Effects/reverb";


export function useAudioEngine(options = {}) {
  const { roomStatus, sendRoomMessage } = options;

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const masterGainRef = useRef(null);
  const recordDestRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const waveCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  const sampleBuffersRef = useRef(new Map());
  const overdriveWorkletReadyRef = useRef(null);
  const reverbCacheRef = useRef({});


  const [waveform, setWaveform] = useState("sine");
  const [effects, setEffects] = useState([]); // [{ type: "reverb" } | { type: "overdrive", ceiling: 0.6, mix: 1 }]

  // ----- Live waveform drawing -----
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

  // ----- Overdrive worklet helpers -----
  const ensureEffectsWorklets = async (ctx) => {
    if (!ctx?.audioWorklet) return;

    if (!overdriveWorkletReadyRef.current) {
      overdriveWorkletReadyRef.current = ctx.audioWorklet
        .addModule("/audio-worklets/Effects/overdrive.js")
        .catch((err) => {
          console.warn("[audio] Failed to load overdrive worklet:", err);
          overdriveWorkletReadyRef.current = null;
        });
    }

    return overdriveWorkletReadyRef.current;
  };


  const createOverdriveNode = async (ctx, params = {}) => {
    await ensureEffectsWorklets(ctx);

    const node = new AudioWorkletNode(ctx, "overdrive-processor");

    node.parameters
      .get("ceiling")
      ?.setValueAtTime(params.ceiling ?? 0.6, ctx.currentTime);

    node.parameters
      .get("mix")
      ?.setValueAtTime(params.mix ?? 1, ctx.currentTime);

    return node;
  };


  const playNote = async (
    freq,
    { source = "local", waveformOverride, effectsOverride } = {}
  ) => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return;

    const oscWaveform = waveformOverride || waveform;

    // Back-compat: allow old string effect to come through
    const fxChainRaw = effectsOverride ?? effects;
    const fxChain = Array.isArray(fxChainRaw)
      ? fxChainRaw
      : fxChainRaw
      ? [{ type: String(fxChainRaw) }]
      : [];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = oscWaveform;
    oscillator.frequency.value = freq;
    gainNode.gain.value = 0.13;

    // IMPORTANT: effects must see the full oscillator amplitude,
    // otherwise ceiling clipping won't trigger.
    let last = oscillator;

    const limitedChain = fxChain.slice(0, 5);


    for (const fx of limitedChain) {
      const type = fx?.type;
      if (!type || type === "none") continue;

      if (type === "overdrive") {
        const od = await createOverdriveNode(ctx, fx);
        last.connect(od);
        last = od;
        continue;
      }

      if (type === "reverb") {
        // ConvolverNode reverb (safe + fast).
        // Mix dry + wet so the note doesn’t disappear.
        const convolver = createReverbNode(ctx, reverbCacheRef);

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.35;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 1.0;

        const sum = ctx.createGain(); // GainNode sums multiple inputs

        // Dry path
        last.connect(dryGain);
        dryGain.connect(sum);

        // Wet path
        last.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(sum);

        last = sum;
        continue;
      }

    }


    last.connect(gainNode);
    gainNode.connect(masterGain);


    oscillator.start();
    oscillator.stop(ctx.currentTime + 1.5);

    // Broadcast to room if this is a local note and we're connected
    if (
      source === "local" &&
      roomStatus === "connected" &&
      typeof sendRoomMessage === "function"
    ) {
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
      source: _source = "local",
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

    // OPTIONAL: broadcast drums later if desired
    void _source; // keep signature for future use
  };

  // Play a note coming from a remote user
  const playRemoteNote = (
    freq,
    { waveform: remoteWaveform, effects: remoteEffects, effect: remoteEffect } = {}
  ) => {
    playNote(freq, {
      source: "remote",
      waveformOverride: remoteWaveform,
      effectsOverride: remoteEffects ?? remoteEffect,
    });
  };

  // Let the room change our effects (if you wire that in)
  const setEffectFromRoom = (roomEffects) => {
    if (Array.isArray(roomEffects)) setEffects(roomEffects);
    else if (roomEffects) setEffects([{ type: String(roomEffects) }]);
    else setEffects([]);
  };

  const loadSample = async (ctx, url) => {
    if (!url) return null;

    const cache = sampleBuffersRef.current;
    if (cache.has(url)) return cache.get(url);

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
