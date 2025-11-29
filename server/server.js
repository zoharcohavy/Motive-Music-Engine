// server.js

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();

// You can add normal routes if you want, e.g.
// app.get("/health", (req, res) => res.send("ok"));

// Create a raw HTTP server that wraps Express:
const server = http.createServer(app);

// 1) Create a WebSocketServer in "noServer" mode.
//    That means *we* decide when to upgrade (in server.on("upgrade")).
const wss = new WebSocketServer({ noServer: true });

// 2) This holds roomName -> Set of connected sockets
const rooms = new Map();

// 3) Handle HTTP upgrade requests (this is how WebSockets start)
server.on("upgrade", (req, socket, head) => {
  const { url } = req;

  // Only allow upgrades for /rooms
  if (!url.startsWith("/rooms")) {
    socket.destroy();
    return;
  }

  // Parse ?room=something from the URL
  const search = url.split("?", 2)[1] || "";
  const params = new URLSearchParams(search);
  const roomName = (params.get("room") || "").trim();

  // If no room name, refuse the connection
  if (!roomName) {
    socket.destroy();
    return;
  }

  // Complete the WebSocket handshake
  wss.handleUpgrade(req, socket, head, (ws) => {
    // We pass roomName as a second argument to "connection"
    wss.emit("connection", ws, roomName);
  });
});

// 4) Fired once a WebSocket connection is accepted
wss.on("connection", (ws, roomName) => {
  // Get or create the room Set
  let clients = rooms.get(roomName);
  if (!clients) {
    clients = new Set();
    rooms.set(roomName, clients);
  }
  clients.add(ws);

  // When this client sends a message...
  ws.on("message", (data) => {
    // ...broadcast it to everyone else in the same room
    for (const client of clients) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(data); // forward as-is (JSON string)
      }
    }
  });

  // When this client disconnects...
  ws.on("close", () => {
    clients.delete(ws);
    // If room is empty, clean it up
    if (clients.size === 0) {
      rooms.delete(roomName);
    }
  });
});

// 5) Start the HTTP+WS server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`HTTP+WS server listening on http://localhost:${PORT}`);
});
