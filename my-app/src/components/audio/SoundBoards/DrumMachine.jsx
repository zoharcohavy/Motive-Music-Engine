import { useState, useEffect, useRef } from "react";
import DrumImage from "../../../assets/images/DrumImage.jpeg";
import kickSample from "../../../assets/drum_samples/kick.wav";
import snareSample from "../../../assets/drum_samples/snare.mp3";
import ToolsIcon from "../../../assets/icons/tools.svg";

// 16 simple pads instead of piano KEYS
// 16 pads with placeholder sample URLs
export const DRUM_PADS = [
  { id: 0,  name: "",   sampleUrl: snareSample },
  { id: 1,  name: "",  sampleUrl: snareSample },
  { id: 2,  name: "",  sampleUrl: snareSample },
  { id: 3,  name: "",  sampleUrl: snareSample },

  { id: 4,  name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 5,  name: "",  sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 6,  name: "",    sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 7,  name: "",    sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 8,  name: "",     sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 9,  name: "",      sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 10, name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },
  { id: 11, name: "",   sampleUrl: "../assets/drum_samples/kick.wav" },

  { id: 12, name: "",     sampleUrl: kickSample },
  { id: 13, name: "",     sampleUrl: kickSample },
  { id: 14, name: "",     sampleUrl: kickSample },
  { id: 15, name: "",     sampleUrl: kickSample },
];


export default function DrumKeyboard({
  pads = DRUM_PADS,
  activeKeyIds = [],
  onMouseDownKey,
  onMouseEnterKey,
  getCharForPadId,
  showCustomize,
  onToggleCustomize,
  layout = "grid",                // "grid" | "kit"
  drumImageScale = 1.25,
  drumKeyOpacity = 0.55,
  drumAnchors,
  setDrumAnchors,
}) {

  const [isMouseDown, setIsMouseDown] = useState(false);

  // Only allow moving when the customize panel is open and we have a setter.
  const overlayRef = useRef(null);
  const dragRef = useRef({
    padId: null,
    startX: 0,
    startY: 0,
    pointerId: null,
  });

  const beginDrag = (padId, e) => {
    if (!setDrumAnchors || layout !== "kit") return;

    const p = e;
    dragRef.current = {
      padId,
      startX: p.clientX,
      startY: p.clientY,
      pointerId: p.pointerId ?? null,
    };

    // capture so we keep getting events even if cursor leaves the button
    try {
      e.currentTarget?.setPointerCapture?.(p.pointerId);
    } catch {
      // ignore
    }
  };

  const endDrag = () => {
    dragRef.current = { padId: null, startX: 0, startY: 0, pointerId: null };
    setIsMouseDown(false);
  };

  useEffect(() => {
      if (!setDrumAnchors || layout !== "kit") return;

    const onMove = (e) => {
      const { padId } = dragRef.current;
      if (padId == null) return;

      const overlayEl = overlayRef.current;
      if (!overlayEl) return;

      const rect = overlayEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      setDrumAnchors((prev) => ({
        ...(prev || {}),
        [padId]: { x, y },
      }));
    };

    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setDrumAnchors, layout]);


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
      <div className={`drumKb__wrap ${layout === "kit" ? "drumKb__wrap--kit" : ""}`}>
        {layout === "kit" ? (
          <div
            className="drumKb__kitBox"
            style={{ transform: `scale(${Number(drumImageScale) || 1.25})` }}
          >
            <img className="drumKb__img" src={DrumImage} alt="Drum kit" />

            <div
              ref={overlayRef}
              className="drumKb__overlay"
              onPointerDown={(e) => {
                e.preventDefault();
                setIsMouseDown(true);
              }}
              onPointerUp={() => setIsMouseDown(false)}
              onPointerLeave={() => setIsMouseDown(false)}
            >

              {pads.map((pad) => {
                const anchor = drumAnchors?.[pad.id] || { x: 0.5, y: 0.5 };

                const ch = getCharForPadId ? getCharForPadId(pad.id) : "";
                const pretty =
                  ch === " "
                    ? "SPACE"
                    : ch === "enter"
                    ? "ENTER"
                    : (ch || "").toUpperCase();

                return (
                  <button
                    key={pad.id}
                    type="button"
                    className={`drumKb__keycap ${
                      isActive(pad.id) ? "drumKb__keycap--active" : ""
                    }`}
                    style={{
                      left: `${anchor.x * 100}%`,
                      top: `${anchor.y * 100}%`,
                      opacity: Number(drumKeyOpacity ?? 0.55),
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      beginDrag(pad.id, e);
                    }}

                    onPointerUp={() => endDrag()}
                    title={`${pretty}`}
                  >
                    <div className="drumKb__keycapChar">{pretty}</div>
                    <div className="drumKb__keycapName">{pad.name || ""}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
    // grid layout (sampler / old behavior)
    <>
      <img className="drumKb__img" src={DrumImage} alt="Drum pad" />

      <div
        className="drumKb__grid"
        onMouseDown={(e) => {
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
              onMouseDownKey?.(pad);
            }}
            onMouseEnter={() => {
              if (isMouseDown) onMouseEnterKey?.(pad);
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
    </>
  )}
      </div>

    </div>
  );
}