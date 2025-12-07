// room-server.js
import http from "http";
import { WebSocketServer } from "ws";

// Simple HTTP server only used for WebSocket upgrades
const server = http.createServer();

// WebSocket server in noServer mode so we control upgrade
const wss = new WebSocketServer({ noServer: true });

// Map of roomName -> Set of ws clients
const rooms = new Map();

// Helper: broadcast usernames + count for a single room
const broadcastOccupancy = (roomName) => {
  const clients = rooms.get(roomName);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: "occupancy",
    room: roomName,
    count: clients.size,
    usernames: Array.from(clients).map(
      (client) => client.username || "Anonymous"
    ),
  });

  console.log("[rooms] broadcasting occupancy:", payload);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
};

server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/rooms") {
      socket.destroy();
      return;
    }

    const roomName = (url.searchParams.get("room") || "").trim();
    if (!roomName) {
      socket.destroy();
      return;
    }

    // Complete the WebSocket handshake
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, roomName);
    });
  } catch (e) {
    console.error("Upgrade error:", e);
    socket.destroy();
  }
});

wss.on("connection", (ws, roomName) => {
  // Get or create room set
  let clients = rooms.get(roomName);
  if (!clients) {
    clients = new Set();
    rooms.set(roomName, clients);
  }
  clients.add(ws);

  console.log(`Client joined room "${roomName}", size=${clients.size}`);

  // 🔔 NEW: broadcast occupancy as soon as someone joins
  broadcastOccupancy(roomName);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      msg = null;
    }

    if (!msg || typeof msg !== "object") {
      return;
    }

    // Handle "join" to set username
    if (msg.type === "join" && typeof msg.username === "string") {
      ws.username = msg.username.trim() || "Anonymous";
      console.log(
        `[rooms] ${roomName}: client set username to "${ws.username}"`
      );

      // 🔔 NEW: when username changes, rebroadcast occupancy
      broadcastOccupancy(roomName);
      return; // don’t forward "join" as a note/message
    }

    // 🔊 Forward note / other music messages to all *other* clients in this room
    for (const client of clients) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`Client left room "${roomName}", size=${clients.size}`);
    if (clients.size === 0) {
      rooms.delete(roomName);
      console.log(`Deleted empty room "${roomName}"`);
    } else {
      // Update occupancy for remaining users
      broadcastOccupancy(roomName);
    }
  });
});

const PORT = 8090;
server.listen(PORT, () => {
  console.log(`Room WebSocket server listening on ws://localhost:${PORT}/rooms`);
});
