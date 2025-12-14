import React, { useState } from "react";
import { KEYS } from "../../../components/audio/constants";

export default function PianoKeyboard({
  activeKeyIds,
  onMouseDownKey,
  onMouseEnterKey,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const whiteKeys = [];
  let whiteIndex = 0;

  KEYS.forEach((key) => {
    if (!key.name.includes("#")) {
      whiteKeys.push({ ...key, whiteIndex });
      whiteIndex += 1;
    }
  });

  const totalWhites = whiteKeys.length;

  const whiteIndexMap = new Map();
  let wIdx = 0;
  KEYS.forEach((key) => {
    if (!key.name.includes("#")) {
      whiteIndexMap.set(key.id, wIdx);
      wIdx += 1;
    }
  });
  const numWhiteForBlack = wIdx;

  const blackKeysPositioned = KEYS.filter((k) => k.name.includes("#")).map(
    (key) => {
      let leftWhiteIndex = 0;
      for (let i = key.id - 1; i >= 0; i--) {
        if (whiteIndexMap.has(i)) {
          leftWhiteIndex = whiteIndexMap.get(i);
          break;
        }
      }
      const offset = leftWhiteIndex + 0.7;
      return { ...key, offset, totalWhite: numWhiteForBlack };
    }
  );

  const isActive = (keyId) => activeKeyIds.includes(keyId);

  return (
    <div
      className="pianoKb"
      onMouseUp={() => setIsMouseDown(false)}
      onMouseLeave={() => setIsMouseDown(false)}
    >

      <div className="pianoKb__inner">
        {/* White keys */}
        {whiteKeys.map((key) => (
          <button
            key={key.id}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsMouseDown(true);
              onMouseDownKey(key);
            }}
            onMouseEnter={() => {
              if (isMouseDown) {
                onMouseEnterKey(key);
              }
            }}
            className={`pianoKb__white ${isActive(key.id) ? "isActive" : ""}`}
            style={{
              left: `calc((100vw / ${totalWhites}) * ${key.whiteIndex})`,
              width: `calc(100vw / ${totalWhites})`,
              borderLeft: key.whiteIndex === 0 ? "1px solid #333" : "0",
            }}
          >
            {key.name.replace("#", "")}
          </button>

        ))}

        {/* Black keys */}
        {blackKeysPositioned.map((key) => (
          <button
            key={`black-${key.id}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsMouseDown(true);
              onMouseDownKey(key);
            }}
            onMouseEnter={() => {
              if (isMouseDown) {
                onMouseEnterKey(key);
              }
            }}
            className={`pianoKb__black ${isActive(key.id) ? "isActive" : ""}`}
            style={{
              left: `calc((100vw / ${key.totalWhite}) * ${key.offset})`,
              width: `calc(100vw / ${key.totalWhite})`,
              transform: "scaleX(0.6)",
            }}
          >
            {key.name}
          </button>

        ))}
      </div>
    </div>
  );
}
