export default function TopControls({
  waveform,
  setWaveform,
  showWaveform = true,
  roomId,
  roomStatus,
  openRoomModal,
  disconnectRoom,
  handleRoomRecordToggle,
  isRoomRecording,
  roomUsernames,
  roomCountdownSeconds,
  roomRecordPhase = "idle",
}) {
  const usersLabel =
    Array.isArray(roomUsernames) && roomUsernames.length > 0
      ? roomUsernames.join(", ")
      : "No other users yet";

  return (
    <div className="topControls__col">
      {/* Top bar: waveform (left) + room controls (center) on the SAME row */}
      <div className="topControls__row">
        {/* Left: Waveform selector (piano only) */}
        <div className="topControls__left">
          {showWaveform && (
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
          )}
        </div>

        {/* Center: Room controls */}
        <div className="topControls__center" style={{ opacity: 1 }}>
          {roomStatus === "connected" && roomId ? (
            <div className="topControls__rooms">
              <div className="topControls__centerButtons">
                <button
                  type="button"
                  onClick={disconnectRoom}
                  className="topControls__roomBtn topControls__roomBtn--connected"
                >
                  Leave Room
                </button>

                <button
                  type="button"
                  onClick={handleRoomRecordToggle}
                  className={`topControls__roomRecBtn roomAllowedStop ${
                    roomRecordPhase !== "idle" ? "topControls__roomRecBtn--active" : ""
                  }`}
                >
                  {roomRecordPhase !== "idle" ? "⏹ Stop Room Record" : "⏺ Record Room"}
                </button>

                {typeof roomCountdownSeconds === "number" && (
                  <span className="topControls__countdown">{roomCountdownSeconds}</span>
                )}
              </div>

              <div className="topControls__centerInfo">
                Room: <strong>{roomId}</strong>
                {" · "}
                Users: {usersLabel}
              </div>
            </div>
          ) : (
            <button type="button" onClick={openRoomModal} className="topControls__roomBtn">
              Connect to Room
            </button>
          )}
        </div>

        {/* Right: spacer to keep center truly centered */}
        <div className="topControls__spacer" />
      </div>
    </div>
  );
}
