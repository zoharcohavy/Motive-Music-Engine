// room-server.js
import http from "http";
import { WebSocketServer } from "ws";

// Simple HTTP server only used for WebSocket upgrades
const server = http.createServer();

// WebSocket server in noServer mode so we control upgrade
const wss = new WebSocketServer({ noServer: true });

// Map of roomName -> Set of ws clients
const rooms = new Map();

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

  ws.on("message", (data) => {
    // Just broadcast raw data to everyone else in the room
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
    }
  });
});

const PORT = 8090;
server.listen(PORT, () => {
  console.log(`Room WebSocket server listening on ws://localhost:${PORT}/rooms`);
});
