// src/audio/constants.js

export const API_BASE = "http://localhost:8080";

const baseFreq = 130.81; // around C3
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function generateKeys() {
  const keys = [];
  for (let i = 0; i < 64; i++) {
    const freq = baseFreq * Math.pow(2, i / 12);
    const octave = 3 + Math.floor(i / 12);
    const name = `${noteNames[i % 12]}${octave}`;
    keys.push({ name, freq, id: i });
  }
  return keys;
}

export const KEYS = generateKeys();

// Keyboard rows: lowest / middle / highest notes
export const LOW_ROW = "zxcvbnm,.";
export const MID_ROW = "asdfghjkl";
export const HIGH_ROW = "qwertyuiop";

export function getKeyIndexForKeyboardChar(char) {
  if (!char) return -1;
  char = char.toLowerCase();

  const lowIdx = LOW_ROW.indexOf(char);
  if (lowIdx !== -1) {
    // lowest notes at the beginning of KEYS
    return lowIdx;
  }

  const midIdx = MID_ROW.indexOf(char);
  if (midIdx !== -1) {
    // middle notes roughly in the middle of KEYS
    const midStart = Math.floor(KEYS.length / 2) - Math.floor(MID_ROW.length / 2);
    return midStart + midIdx;
  }

  const highIdx = HIGH_ROW.indexOf(char);
  if (highIdx !== -1) {
    // highest notes at the end of KEYS
    const highStart = KEYS.length - HIGH_ROW.length;
    return highStart + highIdx;
  }

  return -1;
}
