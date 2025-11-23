import React from "react";
import { KEYS } from "../../components/audio/constants";

export default function PianoKeyboard({
  activeKeyIds,
  onMouseDownKey,
  onMouseEnterKey,
}) {
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
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "90px",
        overflowX: "hidden",
        background: "#ddd",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {/* White keys */}
        {whiteKeys.map((key) => (
          <button
            key={key.id}
            onMouseDown={() => onMouseDownKey(key)}
            onMouseEnter={() => onMouseEnterKey(key)}
            style={{
              position: "absolute",
              left: `calc((100vw / ${totalWhites}) * ${key.whiteIndex})`,
              width: `calc(100vw / ${totalWhites})`,
              height: "100%",
              borderTop: "1px solid #333",
              borderBottom: "1px solid #333",
              borderLeft: key.whiteIndex === 0 ? "1px solid #333" : "0",
              borderRight: "1px solid #333",
              background: isActive(key.id) ? "#eee" : "white",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              paddingBottom: "0.15rem",
              cursor: "pointer",
              userSelect: "none",
              fontSize: "0.5rem",
              overflow: "hidden",
              whiteSpace: "nowrap",
              zIndex: 1,
              opacity: isActive(key.id) ? 0.7 : 1,
            }}
          >
            {key.name.replace("#", "")}
          </button>
        ))}

        {/* Black keys */}
        {blackKeysPositioned.map((key) => (
          <button
            key={`black-${key.id}`}
            onMouseDown={() => onMouseDownKey(key)}
            onMouseEnter={() => onMouseEnterKey(key)}
            style={{
              position: "absolute",
              left: `calc((100vw / ${key.totalWhite}) * ${key.offset})`,
              width: `calc(100vw / ${key.totalWhite})`,
              transform: "scaleX(0.6)",
              height: "60%",
              top: 0,
              border: "1px solid #222",
              background: isActive(key.id) ? "#333" : "black",
              color: "white",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              paddingBottom: "0.15rem",
              cursor: "pointer",
              userSelect: "none",
              fontSize: "0.45rem",
              overflow: "hidden",
              whiteSpace: "nowrap",
              zIndex: 2,
              opacity: isActive(key.id) ? 0.7 : 1,
            }}
          >
            {key.name}
          </button>
        ))}
      </div>
    </div>
  );
}
