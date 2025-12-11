import React, { useState } from "react";
import DrumImage from "../../../assets/images/DrumImage.jpeg";
import kickSample from "../../../assets/drum_samples/kick.wav";
// import snareSample from "../../../assets/drum_samples/snare.wav";
// import hihatClosedSample from "../../../assets/drum_samples/hihat_closed.wav";
// import hihatOpenSample from "../../../assets/drum_samples/hihat_open.wav";
// import tom1Sample from "../../../assets/drum_samples/tom1.wav";
// import tom2Sample from "../../../assets/drum_samples/tom2.wav";

// 16 simple pads instead of piano KEYS
// 16 pads with placeholder sample URLs
export const DRUM_PADS = [
  { id: 0,  name: "Kick 1",   sampleUrl: kickSample },
  { id: 1,  name: "Snare 1",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 2,  name: "HiHat C",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 3,  name: "HiHat O",  sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 4,  name: "Kick 2",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 5,  name: "Snare 2",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 6,  name: "Tom 1",    sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 7,  name: "Tom 2",    sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 8,  name: "Clap",     sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 9,  name: "Rim",      sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 10, name: "Perc 1",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 11, name: "Perc 2",   sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 12, name: "FX 1",     sampleUrl: "/audio/drums/fx-1.mp3" },
  { id: 13, name: "FX 2",     sampleUrl: "/audio/drums/fx-2.mp3" },
  { id: 14, name: "FX 3",     sampleUrl: "/audio/drums/fx-3.mp3" },
  { id: 15, name: "FX 4",     sampleUrl: "/audio/drums/fx-4.mp3" },
];


export default function DrumKeyboard({
  activeKeyIds = [],
  onMouseDownKey,
  onMouseEnterKey,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);

  const isActive = (padId) =>
    Array.isArray(activeKeyIds) && activeKeyIds.includes(padId);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "200px",
        background: "#FFF",
        overflow: "hidden",
      }}
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {/* DRUM IMAGE PLACEHOLDER */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            right: "50%",
            bottom: "3%",
            // Replace this with your <img /> later
            background: "radial-gradient(circle at center, #555, #222)",
            opacity: 0.9,
            zIndex: 1,
          }}
        >
          
          <img
            src={DrumImage}
            alt="Drum"
            style={{ width: "50%", height: "100%", objectFit: "cover" }}
          />
          
        </div>

        {/* 4x4 DRUM PAD GRID OVER THE IMAGE */}
        <div
          style={{
            position: "absolute",
            inset: "15% 20%", // top/right/bottom/left — centers the square grid
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridTemplateRows: "repeat(4, 1fr)",
            gap: "8px",
            zIndex: 2, // make sure pads are on top of image
          }}
        >
          {DRUM_PADS.map((pad) => (
            <button
              key={pad.id}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsMouseDown(true);
                if (onMouseDownKey) onMouseDownKey(pad);
              }}
              onMouseEnter={() => {
                if (isMouseDown && onMouseEnterKey) {
                  onMouseEnterKey(pad);
                }
              }}
              style={{
                border: "2px solid #000",
                borderRadius: "6px",
                background: isActive(pad.id) ? "#ffca3a" : "#888",
                boxShadow: isActive(pad.id)
                  ? "0 0 12px rgba(255, 255, 255, 0.8)"
                  : "0 0 6px rgba(0, 0, 0, 0.8)",
                cursor: "pointer",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                color: "#111",
                fontWeight: "600",
              }}
            >
              {pad.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
