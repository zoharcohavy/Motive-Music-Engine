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
  { id: 0,  name: "k",   sampleUrl: kickSample },
  { id: 1,  name: "m",  sampleUrl: "../assets/drum_samples/kick.wav" },
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
  pads = DRUM_PADS,
  activeKeyIds = [],
  onMouseDownKey,
  onMouseEnterKey,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);

  const isActive = (padId) =>
    Array.isArray(activeKeyIds) && activeKeyIds.includes(padId);

  return (
    <div
      className="drumKb"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >
      <div className="drumKb__inner">
        {/* DRUM IMAGE PLACEHOLDER */}
        <div className="drumKb__imageWrap">
          <img
            src={DrumImage}
            alt="Drum"
            className="drumKb__image"
          />
        </div>

        {/* 4x4 DRUM PAD GRID OVER THE IMAGE */}
        <div className="drumKb__grid">
          {pads.map((pad) => (
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
              className={`drumKb__pad ${isActive(pad.id) ? "drumKb__pad--active" : ""}`}
            >

              {pad.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}