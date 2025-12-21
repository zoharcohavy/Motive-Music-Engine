import { useMemo, useRef, useState } from "react";
import { useDrumKitLayout } from "./useDrumKitLayout";

/**
 * Drums-only UI:
 * - Big drum image (resizable)
 * - Computer-keycap overlays that snap/glue to drum zones
 * - Opacity slider for overlays
 */
export default function DrumKitOverlay({
  drumImageSrc,
  pads,
  activeKeyIds,
  onTriggerPad,
  getCharForPadId,
}) {
  const containerRef = useRef(null);

  const {
    zones,
    anchors,
    drumScale,
    setDrumScale,
    keyOpacity,
    setKeyOpacity,
    setPadAnchor,
    setPadOffset,
    resetLayout,
  } = useDrumKitLayout(pads);

  const [dragging, setDragging] = useState(null); 
  // { padId, grabDelta: {x,y} }

  const zoneById = useMemo(() => {
    const m = new Map();
    zones.forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const pxToNorm = (clientX, clientY) => {
    const r = getRect();
    if (!r) return { x: 0.5, y: 0.5 };
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const distPx = (a, b, rect) => {
    const dx = (a.x - b.x) * rect.width;
    const dy = (a.y - b.y) * rect.height;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const computePadNormPos = (padId) => {
    const a = anchors?.[padId];
    const zone = zoneById.get(a?.zoneId) || zones[0];
    const ox = a?.offset?.x ?? 0;
    const oy = a?.offset?.y ?? 0;
    return { x: zone.x + ox, y: zone.y + oy };
  };

  const onPointerDown = (e, padId) => {
    e.preventDefault();
    e.stopPropagation();

    const r = getRect();
    if (!r) return;

    const mouse = pxToNorm(e.clientX, e.clientY);

    // current key center position (normalized)
    const currPos = computePadNormPos(padId);

    // store delta between mouse point and key center,
    // so drag keeps the exact grab point "under the cursor"
    const grabDelta = { x: mouse.x - currPos.x, y: mouse.y - currPos.y };

    setDragging({ padId, grabDelta });

    try {
        e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };


  const onPointerMove = (e) => {
    if (!dragging) return;

    const r = getRect();
    if (!r) return;

    const mouse = pxToNorm(e.clientX, e.clientY);

    // desired key center position = mouse - grabDelta
    const desired = {
        x: mouse.x - dragging.grabDelta.x,
        y: mouse.y - dragging.grabDelta.y,
    };

    const curr = anchors?.[dragging.padId];
    const zone = zoneById.get(curr?.zoneId) || zones[0];

    // keep same zone while dragging; just update offset
    setPadOffset(dragging.padId, {
        x: desired.x - zone.x,
        y: desired.y - zone.y,
    });
  };


  const onPointerUp = (e) => {
    if (!dragging) return;
    const r = getRect();
    if (!r) return;

    const padId = dragging.padId;

    // Snap-to-nearest-zone if close enough
    const currPos = computePadNormPos(padId);

    let best = null;
    for (const z of zones) {
      const d = distPx(currPos, { x: z.x, y: z.y }, r);
      if (!best || d < best.d) best = { z, d };
    }

    const SNAP_PX = 48;
    if (best && best.d <= SNAP_PX) {
      const curr = anchors?.[padId];
      const newOffset = {
        x: currPos.x - best.z.x,
        y: currPos.y - best.z.y,
      };
      setPadAnchor(padId, best.z.id, newOffset);
    }

    setDragging(null);
  };

  return (
    <div className="drumOverlay">
      <div className="drumOverlay__imageWrap">
        <div
          className="drumOverlay__imageBox"
          ref={containerRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img className="drumOverlay__img" src={drumImageSrc} alt="Drum kit" />

          {/* Optional zone markers (light, so you can tune anchors) */}
          <div className="drumOverlay__zones">
            {zones.map((z) => (
              <div
                key={z.id}
                className="drumOverlay__zoneDot"
                style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%` }}
                title={z.label}
              />
            ))}
          </div>

          {/* Keycaps */}
          {(pads || []).map((pad, i) => {
            const padId = pad?.id ?? String(i);
            const pos = computePadNormPos(padId);
            const isActive = activeKeyIds?.includes?.(padId);

            const charLabel = getCharForPadId ? getCharForPadId(padId) : "";

            return (
              <div
                key={padId}
                className={`drumKeycap ${isActive ? "isActive" : ""}`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  opacity: keyOpacity,
                }}
                onPointerDown={(e) => onPointerDown(e, padId)}
                onDoubleClick={() => onTriggerPad?.(pad)}
                title={`Double-click to trigger. Drag to reposition.`}
              >
                <div className="drumKeycap__kbd">
                  <div className="drumKeycap__char">{(charLabel || "").toUpperCase()}</div>
                  <div className="drumKeycap__name">{pad?.name || pad?.label || padId}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
