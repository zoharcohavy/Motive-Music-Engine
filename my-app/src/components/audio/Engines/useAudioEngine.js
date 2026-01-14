import { useRef, useState, useEffect } from "react";
import { createReverbNode } from "../Effects/reverb";


export function useAudioEngine(options = {}) {
  const { roomStatus, sendRoomMessage } = options;

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const masterGainRef = useRef(null);
  const recordDestRef = useRef(null);
  // NEW: per-track buses (mute/solo) + live input monitoring
  const trackBusRef = useRef(new Map()); // trackId -> { inputGain, outputGain, nodes }
  const liveInputRef = useRef(new Map()); // trackId -> { stream, sourceNode, lastEffectsKey, deviceId }
  const trackRecordDestRef = useRef(new Map()); // trackId -> MediaStreamDestination

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

      // Ask the browser for the lowest practical latency
      const ctx = new AudioCtx({
        latencyHint: "interactive",
        // Optional: if you want to try matching common interface rates:
        // sampleRate: 48000,
      });

      // Make sure it’s actually running (some browsers start suspended)
      ctx.resume?.().catch(() => {});

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
        .addModule(`${process.env.PUBLIC_URL}/audio-worklets/Effects/overdrive.js`)
        .catch((err) => {
          console.warn("[audio] Failed to load overdrive worklet:", err);
          overdriveWorkletReadyRef.current = null;
        });
    }

    return overdriveWorkletReadyRef.current;
  };


  const createOverdriveNode = async (ctx, params = {}) => {
    const ceiling = Math.min(1, Math.max(0.05, Number(params.ceiling ?? 0.6)));
    const mix = Math.min(1, Math.max(0, Number(params.mix ?? 1)));

    // Try AudioWorklet first
    try {
      await ensureEffectsWorklets(ctx);

      // This will throw if the processor never registered
      const node = new AudioWorkletNode(ctx, "overdrive-processor");

      node.parameters.get("ceiling")?.setValueAtTime(ceiling, ctx.currentTime);
      node.parameters.get("mix")?.setValueAtTime(mix, ctx.currentTime);

      return node;
    } catch (err) {
      console.warn("[audio] Overdrive worklet unavailable; using WaveShaper fallback:", err);

      // Fallback: WaveShaper (works everywhere, no worklet required)
      const shaper = ctx.createWaveShaper();
      const n = 2048;
      const curve = new Float32Array(n);

      // Hard clip around ceiling, then normalize back to -1..1
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1; // -1..1
        const y = Math.max(-ceiling, Math.min(ceiling, x));
        curve[i] = y / ceiling;
      }

      shaper.curve = curve;
      shaper.oversample = "4x";

      // If you want mix in fallback: do it outside with dry/wet gains.
      return shaper;
    }
  };


  // Connect an input node through the given FX chain into destination (defaults to masterGain).
  // Returns { output, limitedChain } where output is the last node in the chain.
  const connectThroughFx = async (ctx, inputNode, fxChainRaw, destinationNode) => {
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain || !inputNode) return { output: null, limitedChain: [] };

    const destination = destinationNode || masterGain;

    // Back-compat: allow old string effect values
    const fxChain = Array.isArray(fxChainRaw)
      ? fxChainRaw
      : fxChainRaw
      ? [{ type: String(fxChainRaw) }]
      : [];

    const limitedChain = fxChain.slice(0, 5);

    let last = inputNode;

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
        const convolver = createReverbNode(ctx, reverbCacheRef);

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.35;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 1.0;

        const sum = ctx.createGain();

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

    last.connect(destination);
    return { output: last, limitedChain };
  };

    // ----------------------------
  // Per-track bus routing (mute/solo) + live input monitoring
  // ----------------------------
  // Portastudio-style "Tape FX" per-track chain
  // - inputGain -> saturation (WaveShaper) -> EQ roll-off (lowpass) -> wow/flutter (modulated delay mix)
  //   -> hiss (noise mix) -> outputGain -> master
  // ----------------------------

  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

    const makeSaturationCurve = (drive01, samples = 2048) => {
        const amt = clamp01(drive01);

        // If zero, return an identity curve (no effect)
        if (amt <= 0) {
            const curve = new Float32Array(samples);
            for (let i = 0; i < samples; i++) {
                curve[i] = (i * 2) / (samples - 1) - 1; // x
            }
            return curve;
        }

        const drive = 1 + amt * 20; // 1..21
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = (1 - Math.exp(-drive * x)) / (1 + Math.exp(-drive * x));
        }
        return curve;
    };


  const createTapeFxNodes = (ctx) => {
    // Saturation
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSaturationCurve(0);
    shaper.oversample = "4x";

    // EQ roll-off (classic cassette/tape top-end loss)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 18000;
    lowpass.Q.value = 0.7;

    // Wow/flutter approximation: modulated delay (chorus-like wobble)
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.0;

    const wowLfo = ctx.createOscillator();
    wowLfo.type = "sine";
    wowLfo.frequency.value = 0.6;

    const wowDepth = ctx.createGain();
    wowDepth.gain.value = 0.0; // seconds

    wowLfo.connect(wowDepth);
    wowDepth.connect(delay.delayTime);

    // Mix for wow/flutter so we don't fully smear transients
    const wowWet = ctx.createGain();
    wowWet.gain.value = 0.0;

    const wowDry = ctx.createGain();
    wowDry.gain.value = 1.0;

    const wowSum = ctx.createGain();

    // Hiss (noise bed)
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.0;

    const hissSum = ctx.createGain();

    // Build nodes object
    return {
      shaper,
      lowpass,
      delay,
      wowLfo,
      wowDepth,
      wowWet,
      wowDry,
      wowSum,
      hissGain,
      hissSum,
      hissSource: null,
    };
  };

  const ensureHissSource = (ctx, nodes) => {
    if (nodes.hissSource) return nodes.hissSource;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // simple white noise; we soften later via lowpass in the chain
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 1.0;
    src.connect(g);
    g.connect(nodes.hissGain);
    try {
      src.start();
    } catch (e) {
      // ignore
    }
    nodes.hissSource = src;
    return src;
  };

  const applyTapeFxParams = (ctx, nodes, settings) => {
    const s = settings || {};

    const saturation = clamp01(s.saturation);
    const wowFlutter = clamp01(s.wowFlutter);
    const rollOff = clamp01(s.eqRollOff);
    const hiss = clamp01(s.hiss);

    // Saturation
    nodes.shaper.curve = makeSaturationCurve(saturation);

    // Roll-off: 18k -> 4k
    const nyquist = ctx.sampleRate / 2;
    const maxHz = Math.min(20000, nyquist); // neutral-ish top end
    const minHz = 4000;
    const hz = maxHz - rollOff * (maxHz - minHz);
    nodes.lowpass.frequency.setValueAtTime(hz, ctx.currentTime);


    // Wow/flutter: depth in seconds + rate in Hz
    nodes.wowDepth.gain.setValueAtTime(wowFlutter * 0.008, ctx.currentTime);
    nodes.wowLfo.frequency.setValueAtTime(0.4 + wowFlutter * 5.5, ctx.currentTime);
    nodes.wowWet.gain.setValueAtTime(wowFlutter * 0.55, ctx.currentTime);
    nodes.wowDry.gain.setValueAtTime(1.0, ctx.currentTime);

    // Hiss
    nodes.hissGain.gain.setValueAtTime(hiss * 0.06, ctx.currentTime);
  };

  const getOrCreateTrackBusNodes = (trackId) => {
    const ctx = getAudioContext();
    const masterGain = masterGainRef.current;
    if (!ctx || !masterGain) return null;

    const map = trackBusRef.current;
    if (map.has(trackId)) return map.get(trackId);

    const inputGain = ctx.createGain();
    inputGain.gain.value = 1;

    const outputGain = ctx.createGain();
    outputGain.gain.value = 1;

    const nodes = createTapeFxNodes(ctx);

    // Wire: input -> shaper -> lowpass -> (dry + delay) -> wowSum -> hissSum -> output -> master
    inputGain.connect(nodes.shaper);
    nodes.shaper.connect(nodes.lowpass);

    // wow path
    nodes.lowpass.connect(nodes.wowDry);
    nodes.wowDry.connect(nodes.wowSum);

    nodes.lowpass.connect(nodes.delay);
    nodes.delay.connect(nodes.wowWet);
    nodes.wowWet.connect(nodes.wowSum);

    nodes.wowSum.connect(nodes.hissSum);

    // hiss mix
    nodes.hissGain.connect(nodes.hissSum);

    nodes.hissSum.connect(outputGain);
    outputGain.connect(masterGain);

    // start LFO + hiss source
    try { nodes.wowLfo.start(); } catch (e) {}
    ensureHissSource(ctx, nodes);

    // Defaults: off
    applyTapeFxParams(ctx, nodes, { saturation: 0, wowFlutter: 0, eqRollOff: 0, hiss: 0 });

    const busObj = { inputGain, outputGain, nodes, tapeFx: { saturation: 0, wowFlutter: 0, eqRollOff: 0., hiss: 0 } };
    map.set(trackId, busObj);
    return busObj;
  };

  const setTrackTapeFx = (trackId, settings) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const bus = getOrCreateTrackBusNodes(trackId);
    if (!bus) return;
    const next = {
      saturation: clamp01(settings?.saturation),
      wowFlutter: clamp01(settings?.wowFlutter),
      eqRollOff: clamp01(settings?.eqRollOff),
      hiss: clamp01(settings?.hiss),
    };
    bus.tapeFx = next;
    applyTapeFxParams(ctx, bus.nodes, next);
  };

  // ----------------------------

  const getOrCreateTrackBus = (trackId) => {
    const bus = getOrCreateTrackBusNodes(trackId);
    return bus?.inputGain || null;
  };

    const getOrCreateTrackRecordDest = (trackId) => {
    const ctx = getAudioContext();
    if (!ctx) return null;

    const map = trackRecordDestRef.current;
    if (map.has(trackId)) return map.get(trackId);

    const dest = ctx.createMediaStreamDestination();

    // IMPORTANT: record from the track bus (post mute/solo gain)
    const bus = getOrCreateTrackBusNodes(trackId);
    if (bus?.outputGain) bus.outputGain.connect(dest);

    map.set(trackId, dest);
    return dest;
  };

  const getTrackRecordStream = (trackId) => {
    const dest = getOrCreateTrackRecordDest(trackId);
    return dest?.stream || null;
  };

  // Apply mute/solo to track buses:
  // - if any solo exists, non-solo tracks are muted
  // - mute always mutes that track
  const syncTrackBuses = (tracks) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const list = Array.isArray(tracks) ? tracks : [];
    const hasSolo = list.some((t) => !!t.isSolo);

    for (const t of list) {
      const bus = getOrCreateTrackBus(t.id);
      if (!bus) continue;

      const shouldMute = !!t.isMuted || (hasSolo && !t.isSolo);
      bus.gain.value = shouldMute ? 0 : 1;
    }
  };

  // Live input: connect selected audio input device to a track bus THROUGH that track's FX
  const updateLiveInputForTrack = async (trackId, deviceId, fxChainRaw) => {
    const ctx = getAudioContext();
    if (!ctx || !navigator?.mediaDevices?.getUserMedia) return;

    const map = liveInputRef.current;
    const prev = map.get(trackId);

    // If clearing device, tear down existing
    if (!deviceId) {
      if (prev) {
        try { prev.sourceNode?.disconnect?.(); } catch (e) {}
        try { prev.stream?.getTracks?.().forEach((tr) => tr.stop()); } catch (e) {}
        map.delete(trackId);
      }
      return;
    }

    // If device changed, tear down old
    if (prev && prev.deviceId !== deviceId) {
      try { prev.sourceNode?.disconnect?.(); } catch (e) {}
      try { prev.stream?.getTracks?.().forEach((tr) => tr.stop()); } catch (e) {}
      map.delete(trackId);
    }

    const effectsKey = JSON.stringify(
      Array.isArray(fxChainRaw) ? fxChainRaw : [{ type: String(fxChainRaw || "none") }]
    );

    const cur = map.get(trackId);
    const needsRewire = !cur || cur.effectsKey !== effectsKey;

    let stream = cur?.stream;
    if (!stream) {
      // Ensure the context is running before wiring monitoring
      await ctx.resume?.().catch(() => {});

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },

          // Critical: disable conferencing features that add latency
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,

          // Hint to reduce buffering (not honored everywhere, but helps when it is)
          latency: 0,

          // Optional: helps avoid some resamplers / extra processing
          channelCount: 1,
        },
      });

    }

    if (needsRewire) {
      if (cur?.sourceNode) {
        try { cur.sourceNode.disconnect(); } catch (e) {}
      }

      const sourceNode = ctx.createMediaStreamSource(stream);
      const trackBus = getOrCreateTrackBus(trackId);
      if (!trackBus) return;

      // Route: input -> FX -> track bus -> master
      await connectThroughFx(ctx, sourceNode, fxChainRaw, trackBus);

      map.set(trackId, {
        stream,
        sourceNode,
        deviceId,
        effectsKey,
      });
    } else {
      // keep stream/device updated
      map.set(trackId, { ...cur, stream, deviceId });
    }
  };

  // Helper to list inputs for your "Input" button modal
  const listAudioInputs = async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  };


  // Play an audio URL through the FX chain (used for clips + drum samples)
  const playUrl = async (
    url,
    { offsetSeconds = 0, effectsOverride, gain = 1, destinationNode } = {}
  ) => {
    if (!url) return null;

    const ctx = getAudioContext();
    if (!ctx) return null;

    const buffer = await loadSample(ctx, url);
    if (!buffer) return null;

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;

    // optional gain staging
    const g = ctx.createGain();
    g.gain.value = gain;

    sourceNode.connect(g);

    await connectThroughFx(ctx, g, effectsOverride ?? effects, destinationNode);

    try {
      sourceNode.start(0, Math.max(0, offsetSeconds));
    } catch (e) {
      // ignore start errors
      return null;
    }

    return {
      stop: () => {
        try {
          sourceNode.stop();
        } catch (e) {
          // ignore
        }
      },
    };
  };

  const playNote = async (
    freq,
    { source = "local", waveformOverride, effectsOverride, destinationNode } = {}
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
    const destination = destinationNode || masterGain;
    gainNode.connect(destination);





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
      effectsOverride,
      destinationNode,
    } = {}
  ) => {

    if (!sampleUrl) return;

    const handle = await playUrl(sampleUrl, {
      offsetSeconds: 0,
      effectsOverride,
      destinationNode,
    });

    void handle;


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
    getTrackRecordStream,


    // actions
    playNote,
    playSample,
    playUrl,
    playRemoteNote,
    setEffectFromRoom,

    getOrCreateTrackBus,
    syncTrackBuses,
    updateLiveInputForTrack,
    listAudioInputs,
  };
}
