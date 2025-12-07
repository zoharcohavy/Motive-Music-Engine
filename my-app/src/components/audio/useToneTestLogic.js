import { useRef, useState, useEffect } from "react";
import {
  API_BASE,
  KEYS,
  getKeyIndexForKeyboardChar,
} from "./constants";
//import { drawGenericWave } from "./drawUtils";
import { useRoom } from "./useRoom";
import { useTrackModel } from "./useTrackModel";

export function useToneTestLogic() {
// ---------- REFS ----------
const isMouseDownRef = useRef(false);
const animationFrameRef = useRef(null);
const waveCanvasRef = useRef(null);
const zoomRef = useRef(1);
const recordingTargetTrackIdRef = useRef(null);
const recordStartTimeRef = useRef(null);
const recordDurationRef = useRef(0);
const recordInitialHeadPosRef = useRef(0);
const currentAudioRef = useRef(null);
const draggingHeadTrackIdRef = useRef(null);
const draggingClipRef = useRef(null); // { trackId, clipId, offsetTime }
const activeRecordingTrackIdRef = useRef(null);
const isTransportPlayingRef = useRef(false);
const transportAnimationFrameRef = useRef(null);
//const transportTrackIdRef = useRef(null);
const transportStartWallTimeRef = useRef(null);
const transportStartHeadTimeRef = useRef(0);
const currentClipIdRef = useRef(null);
const transportActiveClipsRef = useRef(new Map());
// audio-related refs (needed by setupAudioContext / getAudioContext)
const audioCtxRef = useRef(null);
const analyserRef = useRef(null);
const masterGainRef = useRef(null);
const convolverRef = useRef(null);
const recordDestRef = useRef(null);
const mediaRecorderRef = useRef(null);
const recordingChunksRef = useRef([]);

// key: `${trackId}:${clipId}` -> HTMLAudioElement
// ---------- STATE ----------
const [waveform, setWaveform] = useState("sine");
const [effect, setEffect] = useState("none");
const [recordings, setRecordings] = useState([]);
const [recordingsError, setRecordingsError] = useState(null);
const [isRoomRecording, setIsRoomRecording] = useState(false);
//const [roomOccupantCount, setRoomOccupantCount] = useState(0); // others in the room

const BASE_STRIP_SECONDS = 10;

const trackApi = useTrackModel({ BASE_STRIP_SECONDS });

const {
  tracks,
  setTracks,
  nextTrackId,
  setNextTrackId,
  globalZoom,
  setGlobalZoom,
  activeRecordingTrackId,
  setActiveRecordingTrackId,
  selectedTrackId,
  setSelectedTrackId,
  mouseMode,
  setMouseMode,
  activeKeyIds,
  setActiveKeyIds,
  tracksRef,
  trackCanvasRefs,
  // getStripSeconds,
  // addTrack,
  // changeZoom,
  // moveTrackRecording,
  // handleTrackStripMouseDown,
  // handleTrackStripMouseMove,
  stopDragging,
} = trackApi;


const getStripSeconds = (track) => {
  const zoom = track.zoom || 1;
  return BASE_STRIP_SECONDS / zoom;
};

const clipsOverlap = (a, b) => {
  const aStart = a.startTime;
  const aEnd = a.startTime + a.duration;
  const bStart = b.startTime;
  const bEnd = b.startTime + b.duration;
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

const willOverlap = (clips, candidate, ignoreId = null) => {
  return (clips || []).some((c) => {
    if (ignoreId && c.id === ignoreId) return false;
    return clipsOverlap(c, candidate);
  });
};

// keep refs synced
// ---------- LIVE WAVEFORM DRAWING ----------
useEffect(() => {
  const canvas = waveCanvasRef.current;
  if (!canvas) return;

  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  // Make sure AudioContext and Analyser exist
  const audioCtx = getAudioContext();
  if (!audioCtx) return;
  const analyser = analyserRef.current;
  if (!analyser) return;

  // Prepare buffer to read time-domain data
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  let frameId;

  const draw = () => {
    if (!waveCanvasRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = rect.width || canvas.width || 0;
    const height = rect.height || canvas.height || 0;
    if (width <= 0 || height <= 0) {
      frameId = requestAnimationFrame(draw);
      return;
    }

    // Resize backing store if needed
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Get the current waveform
    analyser.getByteTimeDomainData(dataArray);

    // Clear background
    ctx2d.clearRect(0, 0, width, height);
    ctx2d.fillStyle = "#111";
    ctx2d.fillRect(0, 0, width, height);

    // Draw the waveform
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = "#4af"; // cyan-ish line
    ctx2d.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;   // 0..2
      const y = (v * 0.5) * height;     // center around middle-ish

      if (i === 0) {
        ctx2d.moveTo(x, y);
      } else {
        ctx2d.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx2d.stroke();

    frameId = requestAnimationFrame(draw);
    animationFrameRef.current = frameId;
  };

  draw();

  return () => {
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
  };
}, [waveform, effect]);

useEffect(() => {
  zoomRef.current = globalZoom;
}, [globalZoom]);

useEffect(() => {
  activeRecordingTrackIdRef.current = activeRecordingTrackId;
}, [activeRecordingTrackId]);

// ---------- TRACK DRAWING ----------
// Draw tracks (clips and tape heads) into canvases whenever tracks or zoom change
// ---------- TAPE-HEAD ANIMATION (RECORDING) ----------
useEffect(() => {
  let frameId = null;

  const step = () => {
  const recorder = mediaRecorderRef.current;
  const isRecording = recorder && recorder.state === "recording";
  const targetTrackId = recordingTargetTrackIdRef.current;

  if (isRecording && (targetTrackId != null) && (recordStartTimeRef.current != null)) {
    // How long we've been recording
    const now = performance.now();
    const elapsedSec = (now - recordStartTimeRef.current) / 1000;

    // Keep this in sync with what onstop uses
    recordDurationRef.current = elapsedSec;

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === targetTrackId);

    if (track) {
      const stripSeconds = getStripSeconds(track);
      const startFrac = recordInitialHeadPosRef.current || 0;

      // Move the head to the right at real-time speed
      let headPos = startFrac;
      if (stripSeconds > 0) {
        headPos = startFrac + elapsedSec / stripSeconds;
      }

      // Clamp to the right edge
      if (headPos >= 1) {
        headPos = 1;
        // Stop recording if we hit the end of the strip
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }

      // Check if we've run into an existing clip on this track
      const stripTime = headPos * stripSeconds;
      const existingClips = track.clips || [];
      const collided = existingClips.find((c) => {
      const start = c.startTime;
      const end = c.startTime + c.duration;
      return stripTime >= start && stripTime <= end;
      });

      if (collided && recorder.state === "recording") {
        // Stop immediately when we reach a different clip
        recorder.stop();
      }

      // Apply the new head position to React state
      setTracks((prev) =>
        prev.map((t) =>
          t.id === targetTrackId ? { ...t, headPos } : t
        )
      );
    }
  }

  frameId = window.requestAnimationFrame(step);
  animationFrameRef.current = frameId;
};

frameId = window.requestAnimationFrame(step);
animationFrameRef.current = frameId;

return () => {
  if (frameId) {
    window.cancelAnimationFrame(frameId);
  }
};
}, [setTracks]);

  // ---------- AUDIO SETUP ----------
  const setupAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);

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

      let recordingImage = null;
      if (targetTrackId != null && trackCanvasRefs.current[targetTrackId]) {
        try {
          recordingImage =
            trackCanvasRefs.current[targetTrackId].toDataURL("image/png");
        } catch (e) {
          console.warn("Could not snapshot tape canvas", e);
        }
      }

if (targetTrackId != null) {
  const duration = recordDurationRef.current || 0;

  setTracks((prev) =>
    prev.map((track) => {
      if (track.id !== targetTrackId) return track;

      const stripSeconds = getStripSeconds(track);
      const clipStartFrac = recordInitialHeadPosRef.current || 0; // 0..1
      const clipStartTime = clipStartFrac * stripSeconds;

      const newClip = {
        id: crypto.randomUUID(),
        url: localUrl,
        duration,
        startTime: clipStartTime,
        startFrac: clipStartFrac,
        image: recordingImage,
      };

      const existing = track.clips || [];

      // Don't allow overlapping clips
      if (willOverlap(existing, newClip)) {
        // TODO: show "cannot record there" message if you want
        return track;
      }

      const updatedClips = [...existing, newClip];

      // Move head to the end of this new clip (0..1 across strip)
      const stripEndTime = clipStartTime + duration;
      const clampedEnd = Math.min(stripSeconds, stripEndTime);
      const headPos =
        stripSeconds > 0 ? clampedEnd / stripSeconds : 0;

      return {
        ...track,
        clips: updatedClips,
        headPos,

        // keep legacy fields for anything still using them
        hasRecording: true,
        recordingUrl: localUrl,
        recordingDuration: duration,
        tapeHeadPos: headPos,
        clipStartPos: clipStartFrac,
        recordingImage,
      };
    })
  );
}


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
      const length = ctx.sampleRate * 2.0;
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }
      }
      convolver.buffer = impulse;
      convolverRef.current = convolver;
    }
    return convolverRef.current;
  };

  // ---------- KEY VISUAL HELPERS ----------
  const pressKeyVisual = (keyId) => {
    setActiveKeyIds((prev) =>
      prev.includes(keyId) ? prev : [...prev, keyId]
    );
  };

  const releaseKeyVisual = (keyId) => {
    setActiveKeyIds((prev) => prev.filter((id) => id !== keyId));
  };

  // ---------- NOTE PLAYBACK ----------
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

    // Broadcast to room if this came from local player
    if (source === "local" && roomStatus === "connected") {
      console.log("[room] sending note", freq);
      sendRoomMessage({
        type: "note",
        freq,
        waveform: oscWaveform,
        effect: fx,
      });
    }
  };


  const handleKeyMouseDown = (key) => {
    isMouseDownRef.current = true;
    pressKeyVisual(key.id);
    playNote(key.freq);
  };

  const handleKeyMouseEnter = (key) => {
    if (isMouseDownRef.current) {
      pressKeyVisual(key.id);
      playNote(key.freq);
    }
  };
  // --- Room -> audio bridge: how to play a remote note ---
  const handleRemoteNote = ({ freq, waveform, effect }) => {
    if (typeof freq !== "number") return;
    playNote(freq, {
      source: "remote",
      waveformOverride: waveform,
      effectOverride: effect,
    });
  };
  // --- Room hook: all WebSocket + room state ---
  const {
    roomId,
    roomStatus,
    roomUsernames,
    isRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    sendRoomMessage,
  } = useRoom({ onRemoteNote: handleRemoteNote });

  // ---------- MOUSE UP / SCRUB PLAY ----------
  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    setActiveKeyIds([]);

    // If we were dragging a clip, just end the drag and do nothing else
    if (draggingClipRef.current) {
      draggingClipRef.current = null;
      return;
    }

    // Otherwise, if we were dragging the tape head, maybe scrub-play
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

// ---------- TAPE-HEAD / SCRUB ----------
// Global tape head: clicking/dragging on any track moves ONE shared head
const updateTrackTapeHeadFromEvent = (trackId, evt) => {
  const rect = evt.currentTarget.getBoundingClientRect();
  let pos = (evt.clientX - rect.left) / rect.width; // 0..1 across full strip
  pos = Math.max(0, Math.min(1, pos));

  setTracks((prev) =>
    prev.map((track) => {
      // If there's a recording on this track, convert strip position → fraction of that recording
      if (track.hasRecording && track.recordingDuration) {
        const zoom = track.zoom || 1;
        const baseDuration = BASE_STRIP_SECONDS; // must match draw loop and TrackSection
        const maxDuration = baseDuration / zoom;

        // pos is 0..1 across maxDuration seconds on strip
        // tapeHeadPos should be 0..1 across track.recordingDuration seconds
        const tapeFrac = Math.min(
          1,
          (pos * maxDuration) / track.recordingDuration
        );

        return {
          ...track,
          tapeHeadPos: tapeFrac,
          headPos: pos, // strip-relative 0..1, shared by ALL tracks logically
        };
      }

      // No recording on this track: just store raw strip fraction
      return {
        ...track,
        tapeHeadPos: pos,
        headPos: pos,
      };
    })
  );
};




  const handleTrackStripMouseDown = (trackId, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width; // 0..1 across the strip
    frac = Math.max(0, Math.min(1, frac));

    const tracksNow = tracksRef.current || [];
    const track = tracksNow.find((t) => t.id === trackId);

    if (track) {
      const stripSeconds = getStripSeconds(track);
      const clickTime = stripSeconds > 0 ? frac * stripSeconds : 0;
      const clips = track.clips || [];

      // Find the clip that contains this time
      const clickedClip = clips.find((c) => {
        const start = c.startTime;
        const end = c.startTime + c.duration;
        return clickTime >= start && clickTime <= end;
      });

      if (clickedClip) {
        // Start dragging this clip; remember how far into the clip we clicked.
        const offsetTime = clickTime - clickedClip.startTime;

        draggingClipRef.current = {
          trackId,
          clipId: clickedClip.id,
          offsetTime, // seconds into the clip where the mouse is
        };

        setSelectedTrackId(trackId);
        return; // don't move the tape head in this case
      }
    }

    // If we didn't click on a clip, fall back to dragging the tape head
    draggingHeadTrackIdRef.current = trackId;
    updateTrackTapeHeadFromEvent(trackId, e);
  };

  const handleTrackStripMouseMove = (trackId, e) => {
    // If a clip is being dragged, move that clip instead of the head
    if (draggingClipRef.current) {
      const { trackId: fromTrackId, clipId, offsetTime } =
        draggingClipRef.current;

      const rect = e.currentTarget.getBoundingClientRect();
      let frac = (e.clientX - rect.left) / rect.width; // 0..1 across this strip
      frac = Math.max(0, Math.min(1, frac));

      // Update tracks in a single, consistent pass
      setTracks((prev) => {
        const fromTrack = prev.find((t) => t.id === fromTrackId);
        const targetTrack = prev.find((t) => t.id === trackId);
        if (!fromTrack || !targetTrack) return prev;

        const originalClip = (fromTrack.clips || []).find(
          (c) => c.id === clipId
        );
        if (!originalClip) return prev;

        const stripSeconds = getStripSeconds(targetTrack);
        const hoverTime = stripSeconds > 0 ? frac * stripSeconds : 0;
        const duration = originalClip.duration || 0;

        // Where would the clip start so that the mouse stays at the same point inside it?
        let newStartTime = hoverTime - (offsetTime || 0);
        if (newStartTime < 0) newStartTime = 0;

        // Don't let it run off the right edge
        const maxStart =
          stripSeconds > 0 ? Math.max(0, stripSeconds - duration) : 0;
        if (newStartTime > maxStart) newStartTime = maxStart;

        const candidateClip = {
          ...originalClip,
          startTime: newStartTime,
          startFrac: stripSeconds > 0 ? newStartTime / stripSeconds : 0,
        };

        // Build the correct "other clips" list on the target track
        const otherTargetClips = (targetTrack.clips || []).filter(
          (c) => c.id !== clipId
        );
        if (willOverlap(otherTargetClips, candidateClip)) {
          // Don't move into an overlapping spot
          return prev;
        }

        // Return new tracks array with the clip living on exactly ONE track
        return prev.map((t) => {
          // Case 1: dragging within the SAME track
          if (t.id === fromTrackId && t.id === trackId) {
            const withoutThis = (t.clips || []).filter(
              (c) => c.id !== clipId
            );
            const cleared =
          withoutThis.length === 0
            ? {
                hasRecording: false,
                recordingUrl: null,
                recordingDuration: 0,
                recordingImage: null,
                clipStartPos: 0,
              }
            : {};
            return {
              ...t,
              clips: [...withoutThis, candidateClip],
              ...cleared,
            };
          }

          // Case 2: remove from the old track if we're moving to a different one
          if (t.id === fromTrackId && fromTrackId !== trackId) {
            const withoutThis = (t.clips || []).filter(
              (c) => c.id !== clipId
            );
            return {
              ...t,
              clips: withoutThis,
            };
          }

          // Case 3: add/update on the new target track
          if (t.id === trackId) {
            const withoutThis = (t.clips || []).filter(
              (c) => c.id !== clipId
            );
            return {
              ...t,
              clips: [...withoutThis, candidateClip],
            };
          }

          // All other tracks unchanged
          return t;
        });
      });

      // Update drag ref so if we cross tracks, fromTrackId follows
      draggingClipRef.current = {
        trackId,
        clipId,
        offsetTime,
      };

      return;
    }

    // No clip being dragged: fallback to moving the tape head
    if (draggingHeadTrackIdRef.current === trackId) {
      updateTrackTapeHeadFromEvent(trackId, e);
    }
  };


  const playTrackFromHead = (track) => {
    if (!track || !track.recordingUrl) return;

    const audio = new Audio(track.recordingUrl);
    currentAudioRef.current = audio;

    const trackId = track.id;
    const startFrac = track.tapeHeadPos || 0;

    const attachTimeUpdate = () => {
      const duration =
        track.recordingDuration && track.recordingDuration > 0
          ? track.recordingDuration
          : audio.duration || 0;
      if (!duration) return;

      audio.addEventListener("timeupdate", () => {
        const frac = audio.currentTime / duration;

        setTracks((prev) =>
          prev.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  tapeHeadPos: Math.min(1, Math.max(0, frac)),
                }
              : t
          )
        );
      });

      audio.addEventListener("ended", () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      });
    };

    audio.addEventListener("loadedmetadata", () => {
      try {
        audio.currentTime = startFrac * audio.duration;
      } catch (e) {}
      attachTimeUpdate();
      audio.play().catch(() => {});
    });

    // In case metadata is already loaded
    attachTimeUpdate();
    audio.play().catch(() => {});
  };


  // Helper: play a specific clip from the current tape-head position on the strip
  const playClipFromHead = (track, clip) => {
  if (!clip || !clip.url) return;

  const audio = new Audio(clip.url);
  currentAudioRef.current = audio;

  const trackId = track.id;

  // Where is the head right now (0..1), and what's that in seconds?
  const stripSecondsInitial = getStripSeconds(track);
  const headPosInitial =
    track.headPos != null ? track.headPos : track.tapeHeadPos || 0;
  const headTimeInitial = headPosInitial * stripSecondsInitial;

  // How far into the clip should we start, based on the head position?
  const offsetInClip = Math.max(0, headTimeInitial - clip.startTime);
  const offsetFrac =
    clip.duration > 0 ? offsetInClip / clip.duration : 0;

  // Keep the tape head in sync with audio time
  const attachTimeUpdate = () => {
    audio.addEventListener("timeupdate", () => {
      const tracksNow = tracksRef.current || [];
      const t = tracksNow.find((tr) => tr.id === trackId);
      if (!t) return;

      const stripSeconds = getStripSeconds(t);

      // audio.currentTime is time inside the clip
      const clipTime = audio.currentTime;
      const headTime = clip.startTime + clipTime;
      const headPos =
        stripSeconds > 0
          ? Math.min(1, headTime / stripSeconds)
          : 0;

      setTracks((prev) =>
        prev.map((tr) =>
          tr.id === trackId ? { ...tr, headPos } : tr
        )
      );
    });

    audio.addEventListener("ended", () => {
      // Clear the current audio reference when done
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
    });
  };

  audio.addEventListener("loadedmetadata", () => {
    try {
      audio.currentTime = offsetFrac * audio.duration;
    } catch (e) {}
    attachTimeUpdate();
    audio.play().catch(() => {});
  });

  // In case metadata is already loaded
  attachTimeUpdate();
  audio.play().catch(() => {});
};
const startClipAudioAtHeadTime = (clip, headTime) => {
  if (!clip || !clip.url) return;

  // Stop any existing audio
  if (currentAudioRef.current) {
    try {
      currentAudioRef.current.pause();
    } catch (e) {}
    currentAudioRef.current = null;
  }

  const audio = new Audio(clip.url);
  currentAudioRef.current = audio;

  // headTime is position on strip (seconds)
  // clip.startTime / clip.duration are also strip seconds
  const offsetInClip = Math.max(0, headTime - clip.startTime); // seconds on strip
  const offsetFrac =
    clip.duration > 0 ? offsetInClip / clip.duration : 0;

  const playAtOffset = () => {
    try {
      audio.currentTime = offsetFrac * audio.duration;
    } catch (e) {}
    audio.play().catch(() => {});
  };

  if (audio.readyState >= 1) {
    // metadata already loaded
    playAtOffset();
  } else {
    audio.addEventListener("loadedmetadata", () => {
      playAtOffset();
    });
  }
};
const stopAllTransportAudio = () => {
  const map = transportActiveClipsRef.current;
  if (!map) return;
  for (const audio of map.values()) {
    try {
      audio.pause();
    } catch (e) {}
  }
  transportActiveClipsRef.current = new Map();
};
  
const toggleTransportPlay = () => {
  // If already playing, stop transport + audio
  if (isTransportPlayingRef.current) {
    isTransportPlayingRef.current = false;
    if (transportAnimationFrameRef.current) {
      cancelAnimationFrame(transportAnimationFrameRef.current);
      transportAnimationFrameRef.current = null;
    }
    stopAllTransportAudio();
    currentClipIdRef.current = null; // no longer used for multi-clip, but safe to reset
    return;
  }

  const tracksNow = tracksRef.current || [];
  if (!tracksNow.length) return;

  // Use a single "global strip length" based on zoom
  const zoom = (tracksNow[0] && tracksNow[0].zoom) || 1;
  const stripSeconds = BASE_STRIP_SECONDS / zoom;

  // Use headPos from any track (since we now keep them in sync)
  let headPos = 0;
  const trackWithHead = tracksNow.find(
    (t) => t.headPos != null || t.tapeHeadPos != null
  );
  if (trackWithHead) {
    headPos =
      trackWithHead.headPos != null
        ? trackWithHead.headPos
        : trackWithHead.tapeHeadPos || 0;
  }
  const headTime = stripSeconds > 0 ? headPos * stripSeconds : 0;

  isTransportPlayingRef.current = true;
  transportStartWallTimeRef.current = performance.now();
  transportStartHeadTimeRef.current = headTime;
  currentClipIdRef.current = null;
  stopAllTransportAudio(); // clear any leftovers

  const step = () => {
    if (!isTransportPlayingRef.current) return;

    const tracksNowInner = tracksRef.current || [];
    if (!tracksNowInner.length) {
      isTransportPlayingRef.current = false;
      stopAllTransportAudio();
      return;
    }

    const zoomNow =
      (tracksNowInner[0] && tracksNowInner[0].zoom) || 1;
    const stripSecondsNow = BASE_STRIP_SECONDS / zoomNow;

    const now = performance.now();
    const elapsed =
      (now - transportStartWallTimeRef.current) / 1000;
    const startTime = transportStartHeadTimeRef.current;

    let newTime = startTime + elapsed;
    let reachedEnd = false;

    if (stripSecondsNow > 0 && newTime >= stripSecondsNow) {
      newTime = stripSecondsNow;
      reachedEnd = true;
    }

    const newHeadPos =
      stripSecondsNow > 0 ? newTime / stripSecondsNow : 0;

    // Move the tape head on *all* tracks so UI stays in sync
    setTracks((prev) =>
      prev.map((tr) => ({
        ...tr,
        headPos: newHeadPos,
        tapeHeadPos: newHeadPos,
      }))
    );

    // Decide what should be playing at this time
    const activeMap =
      transportActiveClipsRef.current || new Map();
    const shouldBeActive = new Set();

    tracksNowInner.forEach((tr) => {
      const clips = tr.clips || [];
      clips.forEach((clip) => {
        if (!clip || !clip.url) return;

        const start = clip.startTime;
        const end = clip.startTime + clip.duration;
        if (newTime >= start && newTime < end) {
          const key = `${tr.id}:${clip.id}`;
          shouldBeActive.add(key);

          // If this clip is not already playing, start it
          if (!activeMap.has(key)) {
            const audio = new Audio(clip.url);

            const offsetInClip = Math.max(
              0,
              newTime - clip.startTime
            );
            const offsetFrac =
              clip.duration > 0
                ? offsetInClip / clip.duration
                : 0;

            const startAudioAtOffset = () => {
              try {
                audio.currentTime =
                  offsetFrac * audio.duration;
              } catch (e) {}
              audio.play().catch(() => {});
            };

            if (audio.readyState >= 1) {
              // metadata loaded
              startAudioAtOffset();
            } else {
              audio.addEventListener(
                "loadedmetadata",
                startAudioAtOffset
              );
            }

            activeMap.set(key, audio);
          }
        }
      });
    });

    // Stop any clips that should no longer be active
    for (const [key, audio] of activeMap.entries()) {
      if (!shouldBeActive.has(key)) {
        try {
          audio.pause();
        } catch (e) {}
        activeMap.delete(key);
      }
    }

    transportActiveClipsRef.current = activeMap;

    if (reachedEnd) {
      isTransportPlayingRef.current = false;
      if (transportAnimationFrameRef.current) {
        cancelAnimationFrame(
          transportAnimationFrameRef.current
        );
        transportAnimationFrameRef.current = null;
      }
      stopAllTransportAudio();
      return;
    }

    transportAnimationFrameRef.current =
      requestAnimationFrame(step);
  };

  transportAnimationFrameRef.current =
    requestAnimationFrame(step);
};


  const togglePlayFromHead = () => {
    const current = currentAudioRef.current;

    // If something is already playing, pause it
    if (current && !current.paused && !current.ended) {
      current.pause();
      return;
    }

    // Otherwise start playback from the head on the selected track
    const t = tracksRef.current.find(
      (tr) => tr.id === selectedTrackId && tr.hasRecording && tr.recordingUrl
    );
    if (!t) return;

    playTrackFromHead(t);
  };

 // Play button in the UI: same behavior as the Space bar
const handleGlobalPlay = () => {
  toggleTransportPlay();
};

  // ---------- SERVER RECORDINGS ----------
  const fetchRecordings = async () => {
    try {
      setRecordingsError(null);
      const res = await fetch(`${API_BASE}/api/recordings`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRecordings(data.recordings || data);
    } catch (err) {
      console.error("Failed to fetch recordings:", err);
      setRecordingsError(err.message || "Unknown error");
    }
  };

  // Load existing recordings once on mount (optional)
  useEffect(() => {
    fetchRecordings();
  }, []);

  // ---------- RECORDING CONTROL ----------
  const handleTrackRecordToggle = (trackId) => {
    const ctx = getAudioContext();
    if (!ctx || !mediaRecorderRef.current) return;

    const recorder = mediaRecorderRef.current;

    // If currently recording, stop
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }

    // Otherwise start recording on this track
    recordingTargetTrackIdRef.current = trackId;
    setActiveRecordingTrackId(trackId);

    // Remember when we started (for duration) and where the head was on the strip
    recordStartTimeRef.current = performance.now();

    const track = tracksRef.current.find((t) => t.id === trackId);
    const headPos =
      track && (track.headPos != null ? track.headPos : track.tapeHeadPos || 0);
    recordInitialHeadPosRef.current = headPos || 0;

    recorder.start();
  };

    const handleRoomRecordToggle = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    // If we’re already recording *room*, stop it
    if (recorder.state === "recording" && isRoomRecording) {
      recorder.stop();
      setIsRoomRecording(false);
      return;
    }

    // Don’t allow room recording if we’re doing a track-specific recording
    if (recorder.state === "recording" && !isRoomRecording) {
      console.warn("Already recording a track; stop that first.");
      return;
    }

    // Start a new "room" recording: no specific track target
    recordingTargetTrackIdRef.current = null;
    recordStartTimeRef.current = performance.now();
    recorder.start();
    setIsRoomRecording(true);
  };


  // ---------- TRACK ZOOM + ADD ----------
  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      {
        id: nextTrackId,
        zoom: globalZoom,
        headPos: 0,
        clips: [],
        hasRecording: false,
        recordingUrl: null,
        recordingDuration: 0,
        tapeHeadPos: 0,
        recordingImage: null,
        clipStartPos: 0,
      },
    ]);
    setNextTrackId((id) => id + 1);
  };

  const changeZoom = (delta) => {
    setGlobalZoom((prev) => {
      const newZoom = Math.max(0.25, Math.min(4, prev + delta));
      setTracks((tracksPrev) =>
        tracksPrev.map((track) => ({
          ...track,
          zoom: newZoom,
        }))
      );
      return newZoom;
    });
  };

  // ---------- MOVE RECORDINGS BETWEEN TRACKS ----------
  const moveTrackRecording = (fromTrackId, toTrackId) => {
    setTracks((prev) => {
      const fromTrack = prev.find((t) => t.id === fromTrackId);
      const toTrack = prev.find((t) => t.id === toTrackId);
      if (!fromTrack || !toTrack) return prev;

      const fromClips = fromTrack.clips || [];
      if (fromClips.length === 0) return prev;

      // For now, move the last clip from one track to the other
      const clipToMove = fromClips[fromClips.length - 1];

      // Prevent overlapping on the target track
      const targetClips = toTrack.clips || [];
      if (willOverlap(targetClips, clipToMove)) {
        return prev;
      }

      const newFromClips = fromClips.slice(0, -1);
      const newToClips = [...targetClips, clipToMove];

      return prev.map((t) => {
        if (t.id === fromTrackId) {
          return { ...t, clips: newFromClips };
        }
        if (t.id === toTrackId) {
          return { ...t, clips: newToClips };
        }
        return t;
      });
    });
  };


  // ---------- KEYBOARD SHORTCUTS ----------
  useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;

      // Space = play / pause from tape head
          if (e.code === "Space" || e.key === " ") {
            e.preventDefault();
            toggleTransportPlay();
            return;
          }


      // Enter = start/stop recording on selected track
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedTrackId != null) {
          handleTrackRecordToggle(selectedTrackId);
        }
        return;
      }

      const keyIndex = getKeyIndexForKeyboardChar(e.key);
      if (keyIndex !== -1 && keyIndex >= 0 && keyIndex < KEYS.length) {
        const keyObj = KEYS[keyIndex];
        pressKeyVisual(keyObj.id);
        playNote(keyObj.freq);
      }
    };

    const handleKeyUp = (e) => {
      const keyIndex = getKeyIndexForKeyboardChar(e.key);
      if (keyIndex !== -1 && keyIndex >= 0 && keyIndex < KEYS.length) {
        const keyObj = KEYS[keyIndex];
        releaseKeyVisual(keyObj.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedTrackId, playNote, toggleTransportPlay, handleTrackRecordToggle]);

  // ---------- RETURN API ----------
  return {
    // state
    waveform,
    setWaveform,
    effect,
    setEffect,
    recordings,
    recordingsError,
    waveCanvasRef,

    mouseMode,
    setMouseMode,

    tracks,
    selectedTrackId,
    setSelectedTrackId,
    globalZoom,
    changeZoom,
    handleGlobalPlay,
    addTrack,
    handleTrackRecordToggle,
    activeRecordingTrackId,

    handleTrackStripMouseDown,
    handleTrackStripMouseMove,
    moveTrackRecording,
    trackCanvasRefs,

    activeKeyIds,
    handleKeyMouseDown,
    handleKeyMouseEnter,
    roomId,
    roomStatus,
    isRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    handleRoomRecordToggle,
    isRoomRecording,
    roomUsernames,
  };
}
