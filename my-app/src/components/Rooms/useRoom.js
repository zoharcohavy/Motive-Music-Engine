// src/components/audio/useRoom.js
import { useRef, useState, useEffect, useCallback } from "react";
import { usePersistedState } from "../audio/usePersistedState";

const ROOM_STORAGE_KEY = "cohavyMusic.roomSession";

export function useRoom({ onRemoteNote }) {
  const roomSocketRef = useRef(null);
  const hasAutoRejoinedRef = useRef(false);

  // Persisted: if user refreshes while in a room, they rejoin.
  // If they were NOT in a room, roomId stays null and nothing happens.
  const [roomSession, setRoomSession] = usePersistedState(ROOM_STORAGE_KEY, {
    roomId: null,
    username: null,
  });

  const roomId = roomSession?.roomId || null;
  const username = roomSession?.username || null;

  const [roomStatus, setRoomStatus] = useState("disconnected");
  // "disconnected" | "connecting" | "connected"
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  const roomUserIdRef = useRef(
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
  const [roomUsernames, setRoomUsernames] = useState([]);

  const sendRoomMessage = useCallback(
    (msg) => {
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
    },
    [roomId]
  );

  const handleRoomMessage = useCallback(
    (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        console.warn("Room message is not valid JSON:", raw);
        return;
      }

      // Ignore our own echoes
      if (msg.userId && msg.userId === roomUserIdRef.current) return;

      switch (msg.type) {
        case "note": {
          if (typeof msg.freq !== "number") return;
          if (!onRemoteNote) return;

          onRemoteNote({
            freq: msg.freq,
            waveform: msg.waveform,
            effect: msg.effect,
          });
          break;
        }

        case "occupancy": {
          if (Array.isArray(msg.usernames)) {
            setRoomUsernames(msg.usernames);
          }
          break;
        }

        default:
          break;
      }
    },
    [onRemoteNote]
  );

  const connectToRoom = useCallback(
    (roomCode, nameInput) => {
      const code = (roomCode || "").trim();
      const name = (nameInput || "").trim();
      if (!code || !name) return;

      // Persist immediately so refresh will rejoin
      setRoomSession({ roomId: code, username: name });

      // Close any existing socket
      if (roomSocketRef.current) {
        try {
          roomSocketRef.current.close();
        } catch {}
        roomSocketRef.current = null;
      }

      setRoomStatus("connecting");
      setRoomUsernames([]);

      const wsUrl = `ws://localhost:8090/rooms?room=${encodeURIComponent(code)}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        roomSocketRef.current = ws;
        setRoomStatus("connected");
        setIsRoomModalOpen(false);

        // Join message (use known code/name directly, not state)
        try {
          ws.send(
            JSON.stringify({
              type: "join",
              username: name,
              userId: roomUserIdRef.current,
              roomId: code,
            })
          );
        } catch (e) {
          console.warn("Failed to send join", e);
        }
      };

      ws.onmessage = (event) => handleRoomMessage(event.data);

      ws.onerror = (err) => console.error("WebSocket room error", err);

      ws.onclose = () => {
        if (roomSocketRef.current === ws) {
          roomSocketRef.current = null;
        }
        setRoomStatus("disconnected");
        setRoomUsernames([]);
        // Do NOT clear persisted session here; refresh should still rejoin.
      };
    },
    [handleRoomMessage, setRoomSession]
  );

  const disconnectRoom = useCallback(() => {
    if (roomSocketRef.current) {
      try {
        roomSocketRef.current.close();
      } catch {}
      roomSocketRef.current = null;
    }
    setRoomStatus("disconnected");
    setRoomUsernames([]);
    // Explicit leave => clear persistence
    setRoomSession({ roomId: null, username: null });
  }, [setRoomSession]);

  const openRoomModal = () => setIsRoomModalOpen(true);
  const closeRoomModal = () => setIsRoomModalOpen(false);

  // Auto-rejoin once on mount if there’s a persisted room
  useEffect(() => {
    if (hasAutoRejoinedRef.current) return;
    hasAutoRejoinedRef.current = true;

    if (roomId && username) {
      connectToRoom(roomId, username);
    }
  }, [roomId, username, connectToRoom]);

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
    username,
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
