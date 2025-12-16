export default function TopControls({
  waveform,
  setWaveform,
  effect,
  setEffect,
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

  return (
    <div className="topControls__col">
    {/* Top bar: room buttons left, room info centered */}
    <div className="topControls__row">

      {/* Left: room buttons */}
      <div className="topControls__left">
        <button
          type="button"
          onClick={roomStatus === "connected" ? disconnectRoom : openRoomModal}
          className={`topControls__roomBtn ${roomStatus === "connected" ? "topControls__roomBtn--connected" : ""}`}
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


      {/* Effect selector */}
      <div className="topControls__group">
        <label>Effect:</label>
        <select
          className="select--compact"
          value={effect}
          onChange={(e) => setEffect(e.target.value)}
        >

          <option value="none">No Effect</option>
          <option value="reverb">Reverb</option>
        </select>
      </div>
    </div>
  );
}
