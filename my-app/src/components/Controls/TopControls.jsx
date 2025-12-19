export default function TopControls({
  waveform,
  setWaveform,
  effects,
  setEffects,
  showWaveform = true,
  roomId,
  roomStatus,
  openRoomModal,
  disconnectRoom,
  handleRoomRecordToggle,
  isRoomRecording,
  roomUsernames,
}) {
  const usersLabel =
    Array.isArray(roomUsernames) && roomUsernames.length > 0
      ? roomUsernames.join(", ")
      : "No other users yet";

  const safeEffects = Array.isArray(effects) ? effects : [];
  const canAdd = safeEffects.length < 5;

  return (
    <div className="topControls__col">
      {/* Top bar: room buttons left, room info centered */}
      <div className="topControls__row">
        {/* Left: room buttons */}
        <div className="topControls__left">
          <button
            type="button"
            onClick={roomStatus === "connected" ? disconnectRoom : openRoomModal}
            className={`topControls__roomBtn ${
              roomStatus === "connected" ? "topControls__roomBtn--connected" : ""
            }`}
          >
            {roomStatus === "connected" ? "Leave Room" : "Connect to Room"}
          </button>

          {roomStatus === "connected" && (
            <button
              type="button"
              onClick={handleRoomRecordToggle}
              className={`topControls__roomRecBtn ${
                isRoomRecording ? "topControls__roomRecBtn--active" : ""
              }`}
            >
              {isRoomRecording ? "⏹ Stop Room Record" : "⏺ Record Room"}
            </button>
          )}
        </div>

        {/* Center: room + usernames */}
        <div className="topControls__center">
          {roomStatus === "connected" && roomId ? (
            <>
              Room: <strong>{roomId}</strong>
              {" · "}
              Users: {usersLabel}
            </>
          ) : (
            <span className="topControls__notInRoom">Not in a room</span>
          )}
        </div>

        {/* Right spacer */}
        <div className="topControls__spacer" />
      </div>

      {/* Waveform selector (piano only) */}
      {showWaveform && (
        <div className="topControls__rowWrap">
          <div className="topControls__group">
            <label>Waveform:</label>
            <select
              className="select--compact"
              value={waveform}
              onChange={(e) => setWaveform(e.target.value)}
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
        </div>
      )}

      {/* Effects chain (max 5) */}
      <div className="topControls__group">
        <label>Effects:</label>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {safeEffects.map((fx, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                padding: "4px 6px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            >
              <select
                className="select--compact"
                value={fx?.type || "none"}
                onChange={(e) => {
                  const type = e.target.value;
                  setEffects((prev) => {
                    const arr = Array.isArray(prev) ? [...prev] : [];
                    const existing = arr[idx] || {};

                    if (type === "none") arr[idx] = { type: "none" };
                    else if (type === "reverb") arr[idx] = { type: "reverb" };
                    else if (type === "overdrive") {
                      arr[idx] = {
                        type: "overdrive",
                        ceiling: existing.ceiling ?? 0.6,
                      };
                    }

                    return arr;
                  });
                }}
              >
                <option value="none">None</option>
                <option value="overdrive">Overdrive</option>
                <option value="reverb">Reverb</option>
              </select>

              {fx?.type === "overdrive" && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Ceiling</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.01"
                    value={fx?.ceiling ?? 0.6}
                    onChange={(e) => {
                      const ceiling = Number(e.target.value);
                      setEffects((prev) => {
                        const arr = Array.isArray(prev) ? [...prev] : [];
                        arr[idx] = { type: "overdrive", ceiling };
                        return arr;
                      });
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                title="Remove effect"
                onClick={() => {
                  setEffects((prev) => {
                    const arr = Array.isArray(prev) ? [...prev] : [];
                    arr.splice(idx, 1);
                    return arr;
                  });
                }}
                className="btn--compact"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setEffects((prev) => {
                const arr = Array.isArray(prev) ? [...prev] : [];
                if (arr.length >= 5) return arr;
                return [...arr, { type: "none" }];
              });
            }}
            className="btn--compact"
            disabled={!canAdd}
            title={!canAdd ? "Max 5 effects" : "Add effect"}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
