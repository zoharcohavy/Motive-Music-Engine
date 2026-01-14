import { useMemo } from "react";
import AppModal from "../ui/AppModal";

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export default function TapeFxModal({
  isOpen,
  onClose,
  trackName = "Track",
  tapeFx,
  onChangeTapeFx,
}) {
  const fx = useMemo(() => {
    const s = tapeFx || {};
    return {
      saturation: clamp01(s.saturation ?? 0),
      wowFlutter: clamp01(s.wowFlutter ?? 0),
      eqRollOff: clamp01(s.eqRollOff ?? 0),
      hiss: clamp01(s.hiss ?? 0),
    };
  }, [tapeFx]);

  const set = (patch) => {
    onChangeTapeFx?.({ ...fx, ...patch });
  };

  return (
    <AppModal
      isOpen={isOpen}
      title={`Tape FX — ${trackName}`}
      onClose={onClose}
      closeOnOverlay
      panelClassName="fxModal__panel"
      footer={
        <div className="fxModal__footer">
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>
      }
    >
      <div className="fxModal__content">
        <div className="fxModal__chip">
          <div className="fxModal__chipTitle">
            Tape Saturation <span className="fxModal__chipValue">{fx.saturation.toFixed(2)}</span>
          </div>
          <input
            className="fxModal__chipSlider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fx.saturation}
            onChange={(e) => set({ saturation: Number(e.target.value) })}
          />
          <div className="fxModal__chipHint">Drive / soft clipping warmth.</div>
        </div>

        <div className="fxModal__chip">
          <div className="fxModal__chipTitle">
            Wow / Flutter <span className="fxModal__chipValue">{fx.wowFlutter.toFixed(2)}</span>
          </div>
          <input
            className="fxModal__chipSlider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fx.wowFlutter}
            onChange={(e) => set({ wowFlutter: Number(e.target.value) })}
          />
          <div className="fxModal__chipHint">Pitch/time wobble from motor/capstan instability.</div>
        </div>

        <div className="fxModal__chip">
          <div className="fxModal__chipTitle">
            EQ Roll-off <span className="fxModal__chipValue">{fx.eqRollOff.toFixed(2)}</span>
          </div>
          <input
            className="fxModal__chipSlider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fx.eqRollOff}
            onChange={(e) => set({ eqRollOff: Number(e.target.value) })}
          />
          <div className="fxModal__chipHint">High-end loss (more roll-off = darker tape).</div>
        </div>

        <div className="fxModal__chip">
          <div className="fxModal__chipTitle">
            Tape Hiss <span className="fxModal__chipValue">{fx.hiss.toFixed(2)}</span>
          </div>
          <input
            className="fxModal__chipSlider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={fx.hiss}
            onChange={(e) => set({ hiss: Number(e.target.value) })}
          />
          <div className="fxModal__chipHint">Noise floor / cassette hiss.</div>
        </div>
      </div>
    </AppModal>
  );
}
