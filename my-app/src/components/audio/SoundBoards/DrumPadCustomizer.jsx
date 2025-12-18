import { useState } from "react";

export default function DrumPadCustomizer({ drumConfig }) {
  const pads = drumConfig?.pads || [];
  const [listeningPadId, setListeningPadId] = useState(null);

  if (!drumConfig) return null;

  const handleKeyAssign = (padId, e) => {
    e.preventDefault();
    e.stopPropagation();

    // Don’t allow Enter or Space (reserved for transport/record)
    if (e.key === "Enter" || e.code === "Space") {
      return;
    }

    // Assign only single-character keys (letters, numbers, punctuation)
    if (e.key && e.key.length === 1) {
      drumConfig.setPadKey(padId, e.key);
      setListeningPadId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 12, marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Drum pad customization
      </div>

      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
        Click “Assign key”, then press a key (Enter/Space are blocked).
        Upload a sample per pad.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {pads.map((pad) => {
          const bound = drumConfig.getCharForPadId(pad.id);
          const pretty =
            bound === " " ? "SPACE" : bound === "enter" ? "ENTER" : (bound || "").toUpperCase();

          return (
            <div
              key={pad.id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
                Pad {pad.id} {bound ? `• Key: ${pretty}` : ""}
              </div>

              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Label
              </label>
              <input
                value={pad.name || ""}
                onChange={(e) => drumConfig.setPadName(pad.id, e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />

              <button
                type="button"
                onClick={() => setListeningPadId(pad.id)}
                style={{ width: "100%", marginBottom: 8 }}
              >
                {listeningPadId === pad.id ? "Press a key…" : "Assign key"}
              </button>

              {/* Invisible key-capture input when listening */}
              {listeningPadId === pad.id ? (
                <input
                  autoFocus
                  onKeyDown={(e) => handleKeyAssign(pad.id, e)}
                  onBlur={() => setListeningPadId(null)}
                  value=""
                  readOnly
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    opacity: 0.75,
                  }}
                  placeholder="Press a key (not Enter/Space)"
                />
              ) : null}

              <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                Sample (audio file)
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) drumConfig.setPadSampleFile(pad.id, f);
                }}
                style={{ width: "100%" }}
              />

              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
                {pad.sampleName ? `Loaded: ${pad.sampleName}` : "Using default sample"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
