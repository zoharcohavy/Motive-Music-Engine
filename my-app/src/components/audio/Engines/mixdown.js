// Room-session mixdown: fetch every stem uploaded for a session folder,
// align them on the shared record-start timeline using the per-stem
// startDeltaMs offsets in session.json, render one combined file with an
// OfflineAudioContext, and save it locally as a WAV.
//
// Runs on each machine after a room recording stops, so everyone walks away
// with the full combined take even though each machine only recorded itself.
import { API_BASE } from "../constants";

const MIX_SAMPLE_RATE = 48000;

// Standard 16-bit PCM WAV encoder
const encodeWavPcm16 = (audioBuffer) => {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels) || 1;
  const numFrames = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(audioBuffer.getChannelData(ch));

  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return buffer;
};

const fetchSessionFileList = async (sessionFolder) => {
  const res = await fetch(`${API_BASE}/api/recordings`);
  if (!res.ok) throw new Error(`Failed to list recordings (HTTP ${res.status})`);
  const data = await res.json();
  const all = Array.isArray(data.recordings) ? data.recordings : [];
  return all.filter((rel) => rel.startsWith(`${sessionFolder}/`));
};

const encodeRelPath = (rel) => rel.split("/").map(encodeURIComponent).join("/");

/**
 * Mix down a finished room session into one WAV and save it locally.
 * Waits briefly for other users' uploads to land before mixing.
 *
 * @param {string} sessionFolder e.g. "NEFROCK:2"
 * @returns {Promise<{fileName: string, stems: string[], durationSec: number}>}
 */
export async function mixdownRoomSession(sessionFolder) {
  const sf = (sessionFolder || "").trim();
  if (!sf) throw new Error("mixdown: no session folder");

  // 1) Wait for uploads from every machine to settle: poll the listing until
  //    the session's file count is stable between two polls (max ~6s).
  let files = await fetchSessionFileList(sf);
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const next = await fetchSessionFileList(sf);
    if (next.length === files.length && next.length > 0) {
      files = next;
      break;
    }
    files = next;
  }
  if (!files.length) throw new Error(`mixdown: no stems found for ${sf}`);

  // 2) Per-stem alignment offsets written by the server at upload time
  let meta = {};
  try {
    const res = await fetch(`${API_BASE}/recordings/${encodeURIComponent(sf)}/session.json`);
    if (res.ok) meta = await res.json();
  } catch {
    // no metadata -> everything aligns at 0
  }

  // 3) Download + decode every stem (skip any that fail to decode)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioCtx();
  const stems = [];
  for (const rel of files) {
    try {
      const res = await fetch(`${API_BASE}/recordings/${encodeRelPath(rel)}`);
      if (!res.ok) continue;
      const arrayBuffer = await res.arrayBuffer();
      const buf = await decodeCtx.decodeAudioData(arrayBuffer);
      const name = rel.slice(sf.length + 1);
      const offsetMs = Number(meta?.[name]?.startDeltaMs) || 0;
      stems.push({ name, buf, offsetMs });
    } catch (e) {
      console.warn(`[mixdown] skipping undecodable stem ${rel}:`, e?.message || e);
    }
  }
  try { decodeCtx.close(); } catch {}
  if (!stems.length) throw new Error(`mixdown: no decodable stems in ${sf}`);

  // 4) Align + render. Normalize offsets so the earliest stem starts at 0.
  const minOffsetMs = Math.min(...stems.map((s) => s.offsetMs));
  const endSec = Math.max(
    ...stems.map((s) => (s.offsetMs - minOffsetMs) / 1000 + s.buf.duration)
  );
  const frames = Math.max(1, Math.ceil(endSec * MIX_SAMPLE_RATE));
  const offline = new OfflineAudioContext(2, frames, MIX_SAMPLE_RATE);

  for (const s of stems) {
    const src = offline.createBufferSource();
    src.buffer = s.buf;
    src.connect(offline.destination);
    src.start((s.offsetMs - minOffsetMs) / 1000);
  }

  const rendered = await offline.startRendering();

  // 5) Encode WAV + save locally
  const wav = encodeWavPcm16(rendered);
  const fileName = `${sf.replace(/[^\w:-]+/g, "_")}__mix.wav`;
  const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);

  const info = {
    fileName,
    stems: stems.map((s) => `${s.name} (+${Math.round(s.offsetMs - minOffsetMs)}ms)`),
    durationSec: rendered.duration,
  };
  console.log("[mixdown] combined take saved:", info);
  return info;
}
