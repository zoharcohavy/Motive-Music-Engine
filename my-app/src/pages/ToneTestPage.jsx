// src/pages/ToneTestPage.jsx
import { useRef } from "react";
import { Link } from "react-router-dom";

export default function ToneTestPage() {
  const audioCtxRef = useRef(null);

  const playSine = () => {
    // Create or reuse AudioContext
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const ctx = audioCtxRef.current;

    // Create oscillator + gain
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 400; // 400 Hz

    // Keep volume reasonable
    gainNode.gain.value = 0.1;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play for 2 seconds
    oscillator.start();
    oscillator.stop(ctx.currentTime + 2);
  };

  const playSquare = () => {
    // Create or reuse AudioContext
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const ctx = audioCtxRef.current;

    // Create oscillator + gain
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 400; // 400 Hz

    // Keep volume reasonable
    gainNode.gain.value = 0.1;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play for 2 seconds
    oscillator.start();
    oscillator.stop(ctx.currentTime + 2);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>400 Hz Test Tone</h1>
      <p>Click the button below to hear a 400 Hz sine wave for 2 seconds.</p>

      <button onClick={playSine} style={{ padding: "0.5rem 1rem", marginRight: "1rem", display:"block" }}>
        Sine
      </button>
       <button onClick={playSquare} style={{ padding: "0.5rem 1rem", marginRight: "1rem", display:"block" }}>
        Square
      </button>

      <Link to="/">
        <button style={{ padding: "0.5rem 1rem" }}>
          Back to Job Search
        </button>
      </Link>
    </div>
  );
}
