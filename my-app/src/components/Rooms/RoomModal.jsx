import React, { useState, useEffect } from "react";

export default function RoomModal({
  isOpen,
  onClose,
  roomStatus,
  roomId,
  username,
  connectToRoom,
  disconnectRoom,
}) {
  const [roomInput, setRoomInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");

  useEffect(() => {
    if (roomId) setRoomInput(roomId);
    if (username) setUsernameInput(username);
  }, [roomId, username]);

  useEffect(() => {
    if (!isOpen) return;
    if (roomId) setRoomInput(roomId);
    if (username) setUsernameInput(username);
  }, [isOpen, roomId, username]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const roomTrimmed = (roomInput || "").trim();
    const userTrimmed = (usernameInput || "").trim();
    if (!roomTrimmed || !userTrimmed) return;
    connectToRoom(roomTrimmed, userTrimmed);
  };

  const handleDisconnect = () => {
    disconnectRoom();
    onClose();
  };

  const statusText =
    roomStatus === "connecting"
      ? "Connecting…"
      : roomStatus === "connected"
      ? roomId
        ? `Connected to "${roomId}"`
        : "Connected"
      : "Not connected";

  return (
    <div className="roomModal__overlay">
      <div className="roomModal__panel">
        {/* Header */}
        <div className="roomModal__header">
          <h2 className="roomModal__title">Connect to room</h2>
          <button
            type="button"
            onClick={onClose}
            className="roomModal__close"
          >
            ✕
          </button>
        </div>

        <p className="roomModal__desc">
          Type a room name. If a room with that name already exists you&apos;ll
          join it; if not, a new room will be created for others to join.
        </p>

        <form
          onSubmit={handleSubmit}
          className="roomModal__form"
        >
          <label className="roomModal__label">
            Room name
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="e.g. piano-lab-1"
              autoFocus
              className="roomModal__input"
            />
          </label>

          <label className="roomModal__label">
            Username (required)
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. Zohar"
              className="roomModal__input"
            />
          </label>

          <div className="roomModal__status">
            Status: {statusText}
          </div>

          <div className="roomModal__actions">
            {roomStatus === "connected" && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="roomModal__btn roomModal__btn--danger"
              >
                Disconnect
              </button>
            )}
            <button
              type="submit"
              disabled={roomStatus === "connecting"}
              className="roomModal__btn roomModal__btn--primary"
              style={{ opacity: roomStatus === "connecting" ? 0.7 : 1 }}
            >
              Join / Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
