import { useRef, useState, useEffect, useCallback } from "react";
import { usePersistedState } from "../ui/usePersistedState";
import { API_BASE } from "../audio/constants";


const ROOM_STORAGE_KEY = "cohavyMusic.roomSession";

export function useRoom({ onRemoteNote, onRoomRecordStart, onRoomRecordStop }) {
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

  
  // Room-synced recording UI/state
  const [roomCountdownSeconds, setRoomCountdownSeconds] = useState(null); // 5..1 or null
  const [roomIsRecording, setRoomIsRecording] = useState(false);
  


  // UI phase for button smoothness:
  // idle -> normal
  // starting -> user clicked record (shows Stop immediately), waiting for countdown/start
  // recording -> actively recording
  const [roomRecordPhase, setRoomRecordPhase] = useState("idle");

  // Convenience: while starting or recording, we consider UI "locked"
  const isRoomLocked = roomRecordPhase !== "idle";

  // Timers + guards so we don’t double-start/stop
  const countdownTimersRef = useRef({ showTimer: null, tick: null });
  const localRoomRecordingRef = useRef(false);
  
  // Authoritative record info from server (used for resync / reconnect)
  const roomSessionFolderRef = useRef(null);
  const roomRecordStartAtMsRef = useRef(null);


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
        const text =
          typeof raw === "string"
            ? raw
            : raw instanceof Blob
            ? null
            : raw instanceof ArrayBuffer
            ? new TextDecoder().decode(raw)
            : null;

        if (text === null && raw instanceof Blob) {
          // Blob parsing must be async, so we bail safely.
          // (If you want, we can switch ws.binaryType to "arraybuffer" to avoid this.)
          return;
        }

        msg = JSON.parse(text);
      } catch {
        console.warn("Room message is not valid JSON:", raw);
        return;
      }


      // Ignore our own echoes ONLY for note messages.
      // For record_countdown / record_start / record_stop, we MUST process the server message
      // even if it originated from us, so everyone's UI and transport stays in sync.
      if (msg.type === "note" && msg.userId && msg.userId === roomUserIdRef.current) {
        return;
      }

      switch (msg.type) {
        case "note": {
          if (typeof msg.freq !== "number") return;
          if (!onRemoteNote) return;

          onRemoteNote({
            freq: msg.freq,
            waveform: msg.waveform,
            effects: msg.effects,
            effect: msg.effect, // backward compatibility
          });
          break;
        }

        case "occupancy": {
          if (Array.isArray(msg.usernames)) {
            setRoomUsernames(msg.usernames);
          }
          break;
        }
        case "record_countdown": {
          // msg: { type, countdownStartAtMs, recordStartAtMs, countFrom }
          const countdownStartAtMs = Number(msg.countdownStartAtMs);
          const recordStartAtMs = Number(msg.recordStartAtMs);
          const countFrom = Number(msg.countFrom || 5);

          if (!countdownStartAtMs || !recordStartAtMs) return;
          roomRecordStartAtMsRef.current = recordStartAtMs;
          // sessionFolder will be confirmed on record_start/status, but countdown can still prep timing


          // Clear any existing countdown timers
          const timers = countdownTimersRef.current;
          if (timers.showTimer) clearTimeout(timers.showTimer);
          if (timers.tick) clearInterval(timers.tick);
          countdownTimersRef.current = { showTimer: null, tick: null };

          setRoomCountdownSeconds(null);
          setRoomRecordPhase("starting");


          const now = Date.now();
          const showDelay = Math.max(0, countdownStartAtMs - now);

          // After ~2 seconds (server-controlled), begin showing 5..1
          timers.showTimer = setTimeout(() => {
            let s = countFrom;
            setRoomCountdownSeconds(s);

            timers.tick = setInterval(() => {
              s -= 1;
              if (s <= 0) {
                clearInterval(timers.tick);
                timers.tick = null;
                setRoomCountdownSeconds(null);
              } else {
                setRoomCountdownSeconds(s);
              }
            }, 1000);
          }, showDelay);

          countdownTimersRef.current = timers;
          break;
        }

        case "record_start": {
          const sf = msg.sessionFolder || null;

          roomSessionFolderRef.current = sf;
          roomRecordStartAtMsRef.current = Date.now(); // server sets recordStartAtMs separately via record_status heartbeat

          setRoomIsRecording(true);
          setRoomRecordPhase("recording");

          // Every client must start exactly once
          if (!localRoomRecordingRef.current) {
            localRoomRecordingRef.current = true;
            onRoomRecordStart?.(sf);
          }
          break;
        }


        case "record_stop": {
          setRoomIsRecording(false);
          setRoomCountdownSeconds(null);

          // Clear countdown timers
          const timers = countdownTimersRef.current;
          if (timers.showTimer) clearTimeout(timers.showTimer);
          if (timers.tick) clearInterval(timers.tick);
          countdownTimersRef.current = { showTimer: null, tick: null };

          const sf = msg.sessionFolder || roomSessionFolderRef.current || null;

          setRoomRecordPhase("finalizing");

          // 🔑 FAILSAFE: never let any client get stuck in "finalizing"
          const unlockTimer = setTimeout(() => {
            roomSessionFolderRef.current = null;
            roomRecordStartAtMsRef.current = null;
            setRoomRecordPhase("idle");
          }, 2500);

          if (localRoomRecordingRef.current) {
            localRoomRecordingRef.current = false;

            // fire-and-forget
            Promise.resolve(onRoomRecordStop?.(sf))
              .catch((err) => {
                console.warn("Room record stop error:", err);
              })
              .finally(() => {
                clearTimeout(unlockTimer);
                roomSessionFolderRef.current = null;
                roomRecordStartAtMsRef.current = null;
                setRoomRecordPhase("idle");
              });
          } else {
            clearTimeout(unlockTimer);
            roomSessionFolderRef.current = null;
            roomRecordStartAtMsRef.current = null;
            setRoomRecordPhase("idle");
          }

          break;
        }





        case "record_status": {
          const isRec = !!msg.isRecording;
          const sf = msg.sessionFolder || null;
          const rs = typeof msg.recordStartAtMs === "number" ? msg.recordStartAtMs : null;

          // Update UI flags
          setRoomIsRecording(isRec);

          // Cache authoritative server values
          if (sf) roomSessionFolderRef.current = sf;
          if (rs) roomRecordStartAtMsRef.current = rs;

          // If server says recording is active, but we didn't start locally → start now
          if (isRec) {
            // Prevent accidental re-start while we're stopping
            if (roomRecordPhase === "finalizing") return;

            if (roomRecordPhase === "idle") setRoomRecordPhase("recording");

            if (!localRoomRecordingRef.current) {
              localRoomRecordingRef.current = true;
              onRoomRecordStart?.(roomSessionFolderRef.current || null);
            }
            return;
          }

          // If server says NOT recording, always ensure UI is unlocked.
          if (!isRec) {
            if (localRoomRecordingRef.current) {
              localRoomRecordingRef.current = false;

              setRoomRecordPhase("finalizing");
              Promise.resolve(onRoomRecordStop?.(roomSessionFolderRef.current || null))
                .catch(() => {})
                .finally(() => {
                  roomSessionFolderRef.current = null;
                  roomRecordStartAtMsRef.current = null;
                  setRoomRecordPhase("idle");
                });
            } else {
              // 🔑 Always unlock UI if server reports not recording
              if (roomRecordPhase !== "idle") {
                roomSessionFolderRef.current = null;
                roomRecordStartAtMsRef.current = null;
                setRoomRecordPhase("idle");
              }
            }
          }

          break;
        }



        default:
          break;
      }
    }, [onRemoteNote, onRoomRecordStart, onRoomRecordStop, roomRecordPhase]
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

      const proto = window.location.protocol === "https:" ? "wss" : "ws";

      // Dev: React runs on :3000, backend websocket server runs on :8080.
      // Change 8080 if your server uses a different port.
      const backendPort = 8080;
      const backendHost =
        window.location.hostname === "localhost"
          ? `${window.location.hostname}:${backendPort}`
          : window.location.host;

      const wsUrl = `${proto}://${backendHost}/rooms?room=${encodeURIComponent(code)}`;


      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";


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
  const toggleRoomRecord = useCallback(() => {
    if (roomRecordPhase === "finalizing") return;
    if (roomStatus !== "connected") return;

    // UI immediate feedback (server still authoritative)
    if (roomRecordPhase === "idle") setRoomRecordPhase("starting");

    sendRoomMessage({ type: "room_record_toggle", username });
  }, [sendRoomMessage, username, roomRecordPhase, roomStatus]);





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
  useEffect(() => {
    if (roomStatus !== "connected") return;

    const id = setInterval(() => {
      // ping triggers server to respond with occupancy + record_status
      sendRoomMessage({ type: "ping", username });
    }, 2000);

    return () => clearInterval(id);
  }, [roomStatus, sendRoomMessage, username]);

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
    toggleRoomRecord,
    roomCountdownSeconds,
    roomIsRecording,
    roomRecordPhase,
    isRoomLocked,
    openRoomModal,
    closeRoomModal,
    connectToRoom,
    disconnectRoom,
    sendRoomMessage,
  };
}
