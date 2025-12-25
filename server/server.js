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
  const out = [];

  const walk = (dir, prefix = "") => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      if (it.name.startsWith(".")) continue;
      const full = path.join(dir, it.name);
      const rel = prefix ? `${prefix}/${it.name}` : it.name;

      if (it.isDirectory()) {
        walk(full, rel);
      } else {
        const lower = it.name.toLowerCase();
        if (lower.endsWith(".wav") || lower.endsWith(".webm") || lower.endsWith(".ogg")) {
          out.push(rel);
        }
      }
    }
  };

  try {
    walk(recordingsDir);
    out.sort((a, b) => b.localeCompare(a)); // newest-ish first
    res.json({ recordings: out });
  } catch (err) {
    console.error("Error reading recordings directory:", err);
    res.status(500).json({ error: "Failed to read recordings directory" });
  }
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

// --- Room recording session numbering: ROOMNAME:0, ROOMNAME:1, ... ---

const roomNextSessionCache = new Map();

const sanitizeRoomNameForFilename = (name) => {
  // Keep colon because you explicitly want ROOMNAME:#.
  // Remove anything that breaks paths.
  return String(name)
    .trim()
    .replace(/[\/\\]/g, "_")
    .replace(/\0/g, "")
    .slice(0, 80) || "ROOM";
};

const getNextRoomSessionNumber = (roomName) => {
  const safe = sanitizeRoomNameForFilename(roomName);

  // cached fast-path
  if (roomNextSessionCache.has(safe)) {
    const next = roomNextSessionCache.get(safe);
    roomNextSessionCache.set(safe, next + 1);
    return next;
  }

  // scan existing files to initialize
  let maxFound = -1;
  try {
    const files = fs.readdirSync(recordingsDir);
    const re = new RegExp(`^${safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:([0-9]+)\\b`);
    for (const f of files) {
      const m = f.match(re);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) maxFound = Math.max(maxFound, n);
      }
    }
  } catch {}

  const next = maxFound + 1;
  roomNextSessionCache.set(safe, next + 1);
  return next;
};



// Upload recording: POST /api/recordings/upload  (field name "audio")
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionFolder = (req.body?.roomSessionFolder || "").trim();
    if (sessionFolder) {
      const safeSession = sanitizeRoomNameForFilename(sessionFolder); // keep ":" allowed
      const dir = path.join(recordingsDir, safeSession);
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      cb(null, dir);
      return;
    }
    cb(null, recordingsDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";

    const sessionFolder = (req.body?.roomSessionFolder || "").trim();
    if (sessionFolder) {
      const username = String(req.body?.username || "Anonymous")
        .trim()
        .replace(/[\/\\]/g, "_")
        .replace(/\0/g, "")
        .slice(0, 40) || "Anonymous";

      const trackName = String(req.body?.trackName || "track")
        .trim()
        .replace(/[\/\\]/g, "_")
        .replace(/\0/g, "")
        .slice(0, 60) || "track";

      // Avoid collisions across users by prefixing username:
      cb(null, `${username}__${trackName}${ext}`);
      return;
    }


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

// 2) This holds roomName -> roomState
// roomState = {
//   clients: Set<WebSocket>,
//   isRecording: boolean,
//   countdownTimer: NodeJS.Timeout | null,
//   startTimer: NodeJS.Timeout | null,
// }
const rooms = new Map();

const getOrCreateRoom = (roomName) => {
  let room = rooms.get(roomName);
  if (!room) {
    room = {
      clients: new Set(),
      isRecording: false,
      countdownTimer: null,
      startTimer: null,
      sessionFolder: null,
      recordStartAtMs: null,
    };
    rooms.set(roomName, room);
  }
  return room;
};

const broadcastToRoom = (roomName, obj) => {
  const room = rooms.get(roomName);
  if (!room || room.clients.size === 0) return;

  const payload = JSON.stringify(obj);
  for (const client of room.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
};

// --- Room occupancy + usernames (from old room-server.js) ---

const broadcastOccupancy = (roomName) => {
  const room = rooms.get(roomName);
  if (!room || room.clients.size === 0) return;

  broadcastToRoom(roomName, {
    type: "occupancy",
    room: roomName,
    count: room.clients.size,
    usernames: Array.from(room.clients).map((c) => c.username || "Anonymous"),
  });
};

const broadcastRecordStatus = (roomName) => {
  const room = rooms.get(roomName);
  if (!room) return;

  broadcastToRoom(roomName, {
    type: "record_status",
    room: roomName,
    isRecording: !!room.isRecording,
    sessionFolder: room.sessionFolder || null,
    recordStartAtMs: room.recordStartAtMs || null,
  });

};



// 3) Handle HTTP upgrade requests (this is how WebSockets start)
server.on("upgrade", (req, socket, head) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Only allow upgrades for EXACT /rooms
    if (url.pathname !== "/rooms") {
      socket.destroy();
      return;
    }

    const roomName = (url.searchParams.get("room") || "").trim();
    if (!roomName) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, roomName);
    });
  } catch (e) {
    console.error("Upgrade error:", e);
    try { socket.destroy(); } catch {}
  }
});

// 4) Fired once a WebSocket connection is accepted
wss.on("connection", (ws, roomName) => {
  const room = getOrCreateRoom(roomName);

  // default username until a join arrives
  ws.username = "Anonymous";

  room.clients.add(ws);

  // announce occupancy + record status immediately
  broadcastOccupancy(roomName);
  broadcastRecordStatus(roomName);

  ws.on("message", (data) => {
    // parse JSON if possible (join + control messages)
    let msg = null;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      msg = null;
    }

    // --- JOIN: set username, don't forward ---
    if (msg && typeof msg === "object" && msg.type === "join") {
      if (typeof msg.username === "string") {
        ws.username = msg.username.trim() || "Anonymous";
      }
      broadcastOccupancy(roomName);
      broadcastRecordStatus(roomName);
      return;
    }

    // --- PING: client requests occupancy + record status ---
    if (msg && typeof msg === "object" && msg.type === "ping") {
      broadcastOccupancy(roomName);
      broadcastRecordStatus(roomName);
      return;
    }

    // --- ROOM RECORD TOGGLE ---
    if (msg && typeof msg === "object" && msg.type === "room_record_toggle") {
      // If currently recording -> STOP for everyone
      if (room.isRecording) {
        // Clear any pending timers
        if (room.countdownTimer) {
          clearTimeout(room.countdownTimer);
          room.countdownTimer = null;
        }
        if (room.startTimer) {
          clearTimeout(room.startTimer);
          room.startTimer = null;
        }
        const finishedSession = room.sessionFolder;

        room.isRecording = false;
        room.sessionFolder = null;
        room.recordStartAtMs = null;
        // Ensure folder exists on stop too (belt + suspenders)
        if (finishedSession) {
          try {
            const dir = path.join(recordingsDir, finishedSession);
            fs.mkdirSync(dir, { recursive: true });
          } catch {}
        }

        broadcastToRoom(roomName, {
          type: "record_stop",
          room: roomName,
          sessionFolder: finishedSession,
        });
        broadcastRecordStatus(roomName);
        return;
      }

      // If NOT recording but countdown is pending -> CANCEL for everyone
      if (room.countdownTimer || room.startTimer) {
        if (room.countdownTimer) {
          clearTimeout(room.countdownTimer);
          room.countdownTimer = null;
        }
        if (room.startTimer) {
          clearTimeout(room.startTimer);
          room.startTimer = null;
        }

        const canceledSession = room.sessionFolder;
        room.sessionFolder = null;
        room.isRecording = false;
        room.recordStartAtMs = null;

        broadcastToRoom(roomName, {
          type: "record_stop",
          room: roomName,
          sessionFolder: canceledSession,
          canceled: true,
        });
        broadcastRecordStatus(roomName);
        return;
      }

      const now = Date.now();
      const countdownStartAtMs = now + 2000; // wait ~2 seconds before showing countdown
      const countFrom = 5;
      const recordStartAtMs = countdownStartAtMs + countFrom * 1000;

      const safeRoom = sanitizeRoomNameForFilename(roomName);
      const session = getNextRoomSessionNumber(safeRoom);
      room.sessionFolder = `${safeRoom}:${session}`;

      // Ensure the folder exists immediately (even before uploads arrive)


      // Tell everyone when countdown starts and when recording starts
      broadcastToRoom(roomName, {
        type: "record_countdown",
        room: roomName,
        countdownStartAtMs,
        recordStartAtMs,
        countFrom,
      });

      // Schedule recording start for everyone
      room.startTimer = setTimeout(() => {
        room.startTimer = null;
        room.isRecording = true;
        room.recordStartAtMs = Date.now(); // <-- ADD THIS
        
        broadcastToRoom(roomName, {
          type: "record_start",
          room: roomName,
          sessionFolder: room.sessionFolder,
        });

        broadcastRecordStatus(roomName);
      }, Math.max(0, recordStartAtMs - now));

      return;
    }

    // --- FORWARD everything else (notes, effects, etc) to everyone else ---
    for (const client of room.clients) {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);

    if (room.clients.size === 0) {
      // cleanup timers if room is empty
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      if (room.startTimer) clearTimeout(room.startTimer);
      rooms.delete(roomName);
    } else {
      broadcastOccupancy(roomName);
      broadcastRecordStatus(roomName);
    }
  });
});


// 5) Start the HTTP+WS server
const PORT = process.env.PORT || 8080;
// Every 5 seconds, broadcast occupancy + record status for all rooms
setInterval(() => {
  for (const [roomName, room] of rooms.entries()) {
    if (!room || room.clients.size === 0) continue;
    broadcastOccupancy(roomName);
    broadcastRecordStatus(roomName);
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`HTTP+WS server listening on http://localhost:${PORT}`);
});
