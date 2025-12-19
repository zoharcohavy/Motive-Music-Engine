// server.js

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- COMMON MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// ---------- RECORDINGS API SETUP ----------

// Folder where .wav files are stored
const recordingsDir = path.join(__dirname, "recordings");



// Make sure the folder exists
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}
// ---------- STORAGE (UPLOADED CLIPS) SETUP ----------

const storageDir = path.join(__dirname, "storage");

// Make sure the folder exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Serve uploaded files at /storage/<filename>
app.use("/storage", express.static(storageDir));


// Serve the raw wav files at /recordings/<filename>
app.use("/recordings", express.static(recordingsDir));

// List recordings: GET /api/recordings
app.get("/api/recordings", (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) {
      console.error("Error reading recordings directory:", err);
      return res.status(500).json({ error: "Failed to read recordings directory" });
    }

    const audioFiles = files
      .filter((f) => {
        const lower = f.toLowerCase();
        return lower.endsWith(".wav") || lower.endsWith(".webm") || lower.endsWith(".ogg");
      })
      // optional: newest first
      .sort((a, b) => b.localeCompare(a));

    res.json({ recordings: audioFiles });
  });
});

// List uploaded clips: GET /api/storage
app.get("/api/storage", (req, res) => {
  fs.readdir(storageDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Failed to list storage" });

    const audioFiles = files
      .filter((f) => !f.startsWith("."))
      .sort((a, b) => b.localeCompare(a));

    res.json({ storage: audioFiles });
  });
});




// Upload recording: POST /api/recordings/upload  (field name "audio")
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".wav";
    const timestamp = Date.now();
    cb(null, `recording_${timestamp}${ext}`);
  },
});

const upload = multer({ storage });

const storageUpload = multer({ dest: storageDir });

// Upload a clip: POST /api/storage/upload (field name: "clip")
app.post("/api/storage/upload", storageUpload.single("clip"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "None" });

  const original = req.file.originalname || "clip";
  const safeOriginal = original.replace(/[^\w.\-() ]+/g, "_");
  const finalName = `${Date.now()}__${safeOriginal}`;

  const fromPath = req.file.path;
  const toPath = path.join(storageDir, finalName);

  fs.rename(fromPath, toPath, (err) => {
    if (err) return res.status(500).json({ error: "Failed to store file" });
    res.json({ filename: finalName });
  });
});

app.post("/api/recordings/upload", upload.single("audio"), (req, res) => {
  console.log("UPLOAD hit /api/recordings/upload");
  console.log("UPLOAD recordingsDir =", recordingsDir);
  console.log("UPLOAD req.file =", req.file);
  console.log("UPLOAD req.body =", req.body);

  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  // prove it's really on disk
  console.log("UPLOAD saved path exists?", fs.existsSync(req.file.path));

  res.json({ success: true, filename: req.file.filename });
});


// Optional health check
app.get("/health", (req, res) => {
  res.send("ok");
});

// ---------- WEBSOCKET ROOMS SETUP ----------

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
