// roomsServer.js
const http = require("http");
const WebSocket = require("ws");

// HTTP server (no Express needed for this)
const server = http.createServer();

// WebSocket server that we manually hook into HTTP 'upgrade'
const wss = new WebSocket.Server({ noServer: true });

// roomId -> Set<WebSocket>
const rooms = new Map();

wss.on("connection", (ws, request, roomId) => {
  // Add this connection to the room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  const room = rooms.get(roomId);
  room.add(ws);

  console.log(`Client joined room "${roomId}". Total in room: ${room.size}`);

  // When we receive a message from *this* client
  ws.on("message", (data) => {
    // Broadcast to everyone else in the same room
    for (const client of room) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => {
    room.delete(ws);
    console.log(
      `Client left room "${roomId}". Remaining: ${room.size}`
    );
    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`Room "${roomId}" deleted (empty).`);
    }
  });
});

// Handle HTTP -> WebSocket "upgrade" requests
server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname !== "/rooms") {
      socket.destroy();
      return;
    }

    const roomId = url.searchParams.get("room") || "default";

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, roomId);
    });
  } catch (err) {
    socket.destroy();
  }
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Room server listening on ws://localhost:${PORT}/rooms`);
});
