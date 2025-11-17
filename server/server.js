// server/server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jobsRouter from "./routes/jobs.js";
import path from "path";
import { fileURLToPath } from "url";

// So we can build an absolute path to .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load server/.env
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/jobsdb";
const PORT = process.env.PORT || 8080;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Mongo connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/jobs", jobsRouter);

app.get("/", (req, res) => {
  res.send("Job API is running");
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});
