// server/server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jobsRouter from "./routes/jobs.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

// so we can build paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load server/.env
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/jobsdb";
const PORT = process.env.PORT || 8080;

// ---------- DATABASE ----------
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Mongo connection error:", err);
    process.exit(1);
  });

// ---------- JOB ROUTES ----------
app.use("/api/jobs", jobsRouter);

// ---------- RECORDING STORAGE SETUP ----------
const recordingsDir = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

// Multer storage for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `recording_${timestamp}.wav`);
  },
});

const upload = multer({ storage });

// Upload audio route
app.post("/api/recordings/upload", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ filename: req.file.filename });
});

// List recordings
app.get("/api/recordings", (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) {
      console.error("Error reading recordings directory:", err);
      return res.status(500).json({ error: "Unable to read files" });
    }
    res.json(files);
  });
});

// Serve recordings statically for download
app.use("/recordings", express.static(recordingsDir));

// ---------- ROOT ----------
app.get("/", (req, res) => {
  res.send("Job API is running");
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
