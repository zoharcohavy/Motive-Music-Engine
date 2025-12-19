import { useState } from "react";
import DrumImage from "../../../assets/images/DrumImage.jpeg";
import kickSample from "../../../assets/drum_samples/kick.wav";
import ToolsIcon from "../../../assets/icons/tools.svg";

// 16 simple pads instead of piano KEYS
// 16 pads with placeholder sample URLs
export const DRUM_PADS = [
  { id: 0,  name: "",   sampleUrl: kickSample },
  { id: 1,  name: "",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 2,  name: "",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 3,  name: "",  sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 4,  name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 5,  name: "",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 6,  name: "",    sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 7,  name: "",    sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 8,  name: "",     sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 9,  name: "",      sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 10, name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 11, name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 12, name: "",     sampleUrl: "/audio/drums/fx-1.mp3" },
  { id: 13, name: "",     sampleUrl: "/audio/drums/fx-2.mp3" },
  { id: 14, name: "",     sampleUrl: "/audio/drums/fx-3.mp3" },
  { id: 15, name: "",     sampleUrl: "/audio/drums/fx-4.mp3" },
];


export default function DrumKeyboard({
  pads = DRUM_PADS,
  activeKeyIds = [],
  onMouseDownKey,
  onMouseEnterKey,
  getCharForPadId,
  showCustomize,
  onToggleCustomize,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);

  const isActive = (padId) =>
    Array.isArray(activeKeyIds) && activeKeyIds.includes(padId);

   return (
    <div className="drum-keypad-container">
      <div className="drum-keypad-header">
        <div className="drum-keypad-title"></div>

        {onToggleCustomize ? (
          <button
            className="drumCustomizeBtn"
            onClick={onToggleCustomize}
            title="Customize drum pads"
            aria-label="Customize drum pads"
          >
            <img src={ToolsIcon} alt="" draggable={false} />
          </button>

        ) : null}
      </div>

      {/* This wrapper MUST be position: relative in CSS */}
      <div className="drumKb__wrap">
        <img className="drumKb__img" src={DrumImage} alt="Drum pad" />

        {/* Keep only ONE overlay grid wrapper */}
        <div
          className="drumKb__grid"
          onMouseDown={(e) => {
            // Allow drag-across triggering
            e.preventDefault();
            setIsMouseDown(true);
          }}
          onMouseUp={() => setIsMouseDown(false)}
          onMouseLeave={() => setIsMouseDown(false)}
        >
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
              className={`drumKb__pad ${
                isActive(pad.id) ? "drumKb__pad--active" : ""
              }`}
            >
              {(() => {
                const ch = getCharForPadId ? getCharForPadId(pad.id) : "";
                const pretty =
                  ch === " "
                    ? "SPACE"
                    : ch === "enter"
                    ? "ENTER"
                    : (ch || "").toUpperCase();
                return ch ? `[${pretty}] ${pad.name}` : pad.name;
              })()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}