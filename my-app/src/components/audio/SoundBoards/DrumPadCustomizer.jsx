import { useState, useRef, useEffect } from "react";

export default function DrumPadCustomizer({ isOpen, onClose, drumConfig }) {
  const pads = drumConfig?.pads || [];
  const [listeningPadId, setListeningPadId] = useState(null);
  const keyInputRefs = useRef({});

  useEffect(() => {
    if (listeningPadId == null) return;
    const el = keyInputRefs.current[listeningPadId];
    if (el) {
      el.focus();
    }
  }, [listeningPadId]);



  if (!isOpen || !drumConfig) return null;

  const makeId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? () => crypto.randomUUID()
      : () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const assignKey = (padId, e) => {
    e.preventDefault();
    e.stopPropagation();

    // avoid hijacking transport / record
    if (e.key === "Enter" || e.code === "Space") return;

    drumConfig.setPadKey?.(padId, e.key);
    setListeningPadId(null);
  };

  
  const setPadName = (padId, name) => {
    // Keep compatibility: call whichever setter you already have
    if (drumConfig.setPadName) drumConfig.setPadName(padId, name);
    else if (drumConfig.renamePad) drumConfig.renamePad(padId, name);
    else if (drumConfig.setPadLabel) drumConfig.setPadLabel(padId, name);
    // If none exist, name will still display from your pads data model,
    // but it won’t persist—so you may need to add one of the above methods.
  };

  return (
    <div className="roomModal__overlay" role="dialog" aria-modal="true">
      <div className="roomModal__panel drumCustomPanel">
        {/* Header: X top-left, tight */}
        <div className="drumCustomHeader">
          <button
            type="button"
            className="roomModal__close"
            onClick={() => {
              setListeningPadId(null);
              onClose?.();
            }}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
          <div className="drumCustomTitle">Drum pad customization (click 'key' to re-assign it)</div>
        </div>

        <div className="drumCustomBody">
          <div className="drumPadGrid">
            {pads.map((pad) => {
              const key = drumConfig.getCharForPadId?.(pad.id);
              const prettyKey =
                key === " " ? "SPACE" : key ? key.toUpperCase() : "";

              const fileInputId = `pad-file-${pad.id}-${makeId()}`;

              return (
                <div className="drumPadCard" key={pad.id}>
                  {/* Row 1: Name (left) + Assign key (right) */}
                  <div className="drumRow">
                    <input
                      className="drumNameInput"
                      value={pad.name || `Pad ${pad.id}`}
                      onChange={(e) => setPadName(pad.id, e.target.value)}
                      title="Pad name"
                    />

                    <button
                      type="button"
                      className="drumHalfBtn"
                      onClick={() => setListeningPadId(pad.id)}
                      title="Assign key"
                    >
                      {listeningPadId === pad.id ? "Press key…" : `Key: ${prettyKey || "—"}`}
                    </button>
                  </div>

                  {/* Key capture (only when listening) */}
                  {listeningPadId === pad.id ? (
                    <input
                      ref={(el) => {
                        keyInputRefs.current[pad.id] = el;
                      }}
                      autoFocus
                      className="drumKeyCapture"
                      onKeyDown={(e) => assignKey(pad.id, e)}
                      onBlur={() => setListeningPadId(null)}
                      value=""
                      readOnly
                      placeholder="Press a key (not Enter/Space)"
                    />
                  ) : null}

                  {/* Row 2: Square choose button + filename */}
                  <div className="drumFileRow">
                    <input
                      id={fileInputId}
                      type="file"
                      accept="audio/*"
                      className="drumHiddenFile"
                      onChange={(e) =>
                        drumConfig.setPadSampleFile?.(pad.id, e.target.files?.[0])
                      }
                    />

                    <label
                      htmlFor={fileInputId}
                      className="drumFileBtn"
                      title="Choose sample"
                      aria-label="Choose sample"
                    >
                      🎵
                    </label>

                    <div className="drumFileName" title={pad.sampleName || ""}>
                      {pad.sampleName ? pad.sampleName : "Default sample"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
