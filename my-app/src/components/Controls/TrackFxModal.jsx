import { useEffect, useMemo, useState } from "react";

export default function TrackFxModal({
  isOpen,
  onClose,
  trackName,
  effects,
  onChangeEffects,
}) {
  const safeEffects = useMemo(() => (Array.isArray(effects) ? effects : []), [effects]);
  const canAdd = safeEffects.length < 5;


  const [addEffectType, setAddEffectType] = useState("overdrive");


  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fxModal__overlay" onMouseDown={onClose}>
      <div className="fxModal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="fxModal__header">
          <h2 className="fxModal__title">Track FX{trackName ? ` — ${trackName}` : ""}</h2>
          <button type="button" onClick={onClose} className="fxModal__close">✕</button>
        </div>

        <p className="fxModal__desc">
          Up to 5 effects per track. These FX are applied during playback for this track.
        </p>

        <div className="fxModal__list">
          {safeEffects.map((fx, idx) => (
            <div key={idx} className="fxModal__row">
              <div className="fxModal__chip">
                <div className="fxModal__chipTitle">
                  {fx?.type === "overdrive" ? "Overdrive" : "Reverb"}
                </div>

                <input
                  className="fxModal__chipSlider"
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.01"
                  value={
                    fx?.type === "overdrive"
                      ? fx?.ceiling ?? 0.6
                      : fx?.amount ?? 0.35
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const next = [...safeEffects];

                    if (fx?.type === "overdrive") {
                      next[idx] = { ...next[idx], ceiling: v };
                    } else {
                      next[idx] = { ...next[idx], amount: v };
                    }

                    onChangeEffects?.(next);
                  }}
                />

                <div className="fxModal__chipValue">
                  {fx?.type === "overdrive"
                    ? `Ceiling: ${(fx?.ceiling ?? 0.6).toFixed(2)}`
                    : `Amount: ${(fx?.amount ?? 0.35).toFixed(2)}`}
                </div>
              </div>

              <button
                type="button"
                className="btn btn--compact"
                title="Remove effect"
                onClick={() => {
                  const next = [...safeEffects];
                  next.splice(idx, 1);
                  onChangeEffects?.(next);
                }}
              >
                ✕
              </button>
            </div>
          ))}

        </div>

        <div className="fxModal__actions">
          <select
            className="select--compact"
            value={addEffectType}
            onChange={(e) => setAddEffectType(e.target.value)}
            disabled={!canAdd}
            title={!canAdd ? "Max 5 effects" : "Choose an effect to add"}
          >
            <option value="overdrive">Overdrive</option>
            <option value="reverb">Reverb</option>
          </select>

          <button
            type="button"
            className="btn btn--compact"
            disabled={!canAdd}
            onClick={() => {
              if (!canAdd) return;

              const next = [...safeEffects];

              if (addEffectType === "overdrive") {
                next.push({ type: "overdrive", ceiling: 0.6 });
              } else if (addEffectType === "reverb") {
                next.push({ type: "reverb", amount: 0.35 }); // slider is "useless" for now
              }

              onChangeEffects?.(next);
            }}
          >
            + Effect
          </button>

          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
