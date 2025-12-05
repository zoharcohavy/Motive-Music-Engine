// src/components/audio/useRoom.js
import { useRef, useState, useEffect } from "react";

export function useRoom({ onRemoteNote }) {
  const roomSocketRef = useRef(null);
  const [roomId, setRoomId] = useState(null);
  const [roomStatus, setRoomStatus] = useState("disconnected"); 
  // "disconnected" | "connecting" | "connected"
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const roomUserIdRef = useRef(
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
  const [roomUsernames, setRoomUsernames] = useState([]);

  const sendRoomMessage = (msg) => {
    const ws = roomSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      ...msg,
      userId: roomUserIdRef.current,
      roomId,
    };

    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to send room message", e);
    }
  };

  const handleRoomMessage = (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn("Room message is not valid JSON:", raw);
      return;
    }

    // Ignore our own echoes
    if (msg.userId && msg.userId === roomUserIdRef.current) {
      return;
    }

    if (!msg.type) {
      console.warn("Room message missing type:", msg);
      return;
    }

    switch (msg.type) {
      case "note": {
        if (typeof msg.freq === "number") {
          console.log("[room] playing remote note", msg.freq);
          if (onRemoteNote) {
            onRemoteNote({
              freq: msg.freq,
              waveform: msg.waveform,
              effect: msg.effect,
            });
          }
        } else {
          console.warn("Room note missing freq:", msg);
        }
        break;
      }

      case "occupancy": {
        if (Array.isArray(msg.usernames)) {
          setRoomUsernames(msg.usernames);
        }
        break;
      }

      default:
        console.log("[room] unhandled message type:", msg.type, msg);
        break;
    }
  };

  const connectToRoom = (roomCode, username) => {
    const code = (roomCode || "").trim();
    const name = (username || "").trim();
    if (!code || !name) return;

    // Close any existing connection
    if (roomSocketRef.current) {
      try {
        roomSocketRef.current.close();
      } catch {}
      roomSocketRef.current = null;
    }

    setRoomStatus("connecting");
    setRoomId(null);
    setRoomUsernames([]);

    const wsUrl = `ws://localhost:8090/rooms?room=${encodeURIComponent(code)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      roomSocketRef.current = ws;
      setRoomId(code);
      setRoomStatus("connected");
      setIsRoomModalOpen(false);

      // Tell the server who we are
      sendRoomMessage({
        type: "join",
        username: name,
      });
    };

    ws.onmessage = (event) => {
      handleRoomMessage(event.data);
    };

    ws.onerror = (err) => {
      console.error("WebSocket room error", err);
    };

    ws.onclose = () => {
      if (roomSocketRef.current === ws) {
        roomSocketRef.current = null;
      }
      setRoomStatus("disconnected");
      setRoomId(null);
      setRoomUsernames([]);
    };
  };

  const disconnectRoom = () => {
    if (roomSocketRef.current) {
      try {
        roomSocketRef.current.close();
      } catch {}
      roomSocketRef.current = null;
    }
    setRoomId(null);
    setRoomStatus("disconnected");
    setRoomUsernames([]);
  };

  const openRoomModal = () => setIsRoomModalOpen(true);
  const closeRoomModal = () => setIsRoomModalOpen(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomSocketRef.current) {
        try {
          roomSocketRef.current.close();
        } catch {}
        roomSocketRef.current = null;
      }
    };
  }, []);

  return {
    roomId,
    roomStatus,
    roomUsernames,
    isRoomModalOpen,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    sendRoomMessage,
  };
}
 