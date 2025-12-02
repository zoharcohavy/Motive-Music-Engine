import React, { useState, useEffect } from "react";

export default function RoomModal({
  isOpen,
  onClose,
  roomStatus,
  roomId,
  connectToRoom,
  disconnectRoom,
}) {
const [roomInput, setRoomInput] = useState("");
const [usernameInput, setUsernameInput] = useState("");

useEffect(() => {
  // When you’re already in a room, pre-fill the room name
  if (roomId) setRoomInput(roomId);
}, [roomId]);


  if (!isOpen) return null;

  const handleSubmit = (e) => {
  e.preventDefault();
  const roomTrimmed = (roomInput || "").trim();
  const userTrimmed = (usernameInput || "").trim();
  if (!roomTrimmed || !userTrimmed) {
    // both are required
    return;
  }
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid #555",
          borderRadius: 8,
          padding: "1.25rem 1.5rem",
          minWidth: 320,
          color: "#eee",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Connect to room</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", margin: "0 0 0.75rem 0" }}>
          Type a room name. If a room with that name already exists you&apos;ll
          join it; if not, a new room will be created for others to join.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <label style={{ fontSize: "0.8rem" }}>
  Room name
  <input
    type="text"
    value={roomInput}
    onChange={(e) => setRoomInput(e.target.value)}
    placeholder="e.g. piano-lab-1"
    autoFocus
    style={{
      width: "100%",
      marginTop: "0.25rem",
      padding: "0.35rem 0.5rem",
      borderRadius: 4,
      border: "1px solid #555",
      background: "#111",
      color: "#fff",
      fontSize: "0.9rem",
    }}
  />
</label>

<label style={{ fontSize: "0.8rem" }}>
  Username (required)
  <input
    type="text"
    value={usernameInput}
    onChange={(e) => setUsernameInput(e.target.value)}
    placeholder="e.g. Zohar"
    style={{
      width: "100%",
      marginTop: "0.25rem",
      padding: "0.35rem 0.5rem",
      borderRadius: 4,
      border: "1px solid #555",
      background: "#111",
      color: "#fff",
      fontSize: "0.9rem",
    }}
  />
</label>


          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
            Status: {statusText}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.25rem",
            }}
          >
            {roomStatus === "connected" && (
              <button
                type="button"
                onClick={handleDisconnect}
                style={{
                  padding: "0.3rem 0.6rem",
                  borderRadius: 4,
                  border: "1px solid #944",
                  background: "#411",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                Disconnect
              </button>
            )}
            <button
              type="submit"
              disabled={roomStatus === "connecting"}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 4,
                border: "1px solid #5af",
                background: "#154",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.8rem",
                opacity: roomStatus === "connecting" ? 0.7 : 1,
              }}
            >
              Join / Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
