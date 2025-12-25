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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
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
                <span style={{ fontWeight: 800 }}>{roomCountdownSeconds}</span>
              )}
            </div>
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
    </div>
  );
}
