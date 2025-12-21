import { useEffect, useState } from "react";
import DrumKitOverlay from "./DrumKitOverlay";
import { useDrumKitLayout } from "./useDrumKitLayout";

export default function DrumDragsCustomizerModal({
  isOpen,
  onClose,
  drumImageSrc,
  pads,
  activeKeyIds,
  onTriggerPad,
  getCharForPadId,
}) {
  const [tab, setTab] = useState("general");

  const {
    drumScale,
    setDrumScale,
    keyOpacity,
    setKeyOpacity,
    resetLayout,
  } = useDrumKitLayout(pads);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const canRender = isOpen && pads && pads.length;
  if (!isOpen) return null;

  return (
    <div className="fxModal__overlay" onMouseDown={onClose}>
      <div className="fxModal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fxModal__header">
          <h2 className="fxModal__title">Drum Customize</h2>
          <button type="button" onClick={onClose} className="fxModal__close">
            ✕
          </button>
        </div>

        <div className="drumTabs">
          <button
            type="button"
            className={`drumTabs__tab ${tab === "general" ? "isActive" : ""}`}
            onClick={() => setTab("general")}
          >
            General
          </button>
          <button
            type="button"
            className={`drumTabs__tab ${tab === "assign" ? "isActive" : ""}`}
            onClick={() => setTab("assign")}
          >
            Assign Keys
          </button>
        </div>

        {tab === "general" ? (
          <div className="drumGeneral">
            <div className="drumGeneral__row">
              <div className="drumGeneral__label">Drum image size</div>
              <input
                type="range"
                min="0.9"
                max="1.8"
                step="0.01"
                value={drumScale}
                onChange={(e) => setDrumScale(Number(e.target.value))}
              />
              <div className="drumGeneral__value">{Math.round(drumScale * 100)}%</div>
            </div>

            <div className="drumGeneral__row">
              <div className="drumGeneral__label">Key transparency</div>
              <input
                type="range"
                min="0.15"
                max="0.95"
                step="0.01"
                value={keyOpacity}
                onChange={(e) => setKeyOpacity(Number(e.target.value))}
              />
              <div className="drumGeneral__value">{Math.round(keyOpacity * 100)}%</div>
            </div>

            <div className="drumGeneral__row drumGeneral__row--actions">
              <button type="button" className="btn btn--compact" onClick={resetLayout}>
                Reset layout
              </button>
              <div className="drumGeneral__hint">
                Reset applies your cymbal/tom/snare/kick rows + side spares.
              </div>
            </div>
          </div>
        ) : (
          <div className="drumAssign">
            {canRender ? (
              <DrumKitOverlay
                drumImageSrc={drumImageSrc}
                pads={pads}
                activeKeyIds={activeKeyIds}
                onTriggerPad={onTriggerPad}
                getCharForPadId={getCharForPadId}
              />
            ) : null}
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
