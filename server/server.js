import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jobsRouter from "./routes/jobs.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/jobsdb";
const PORT = process.env.PORT || 8080;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
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