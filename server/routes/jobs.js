// server/routes/jobs.js
import express from "express";
import Job from "../models/Job.js";

const router = express.Router();

// GET /api/jobs/search
router.get("/search", async (req, res) => {
  try {
    const {
      query,
      jobType,
      experience,
      datePosted,
      sort,
      page = "1",
    } = req.query;

    const mongoQuery = {};

    // Text search on title/company/description
    if (query) {
      const regex = new RegExp(query, "i");
      mongoQuery.$or = [
        { title: regex },
        { company: regex },
        { description: regex },
      ];
    }

    if (jobType) {
      mongoQuery.jobType = jobType;
    }

    if (experience) {
      mongoQuery.experience = experience;
    }

    // datePosted = "1", "3", "7" (days back)
    if (datePosted) {
      const days = parseInt(datePosted, 10);
      if (!Number.isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        mongoQuery.postedAt = { $gte: cutoff };
      }
    }

    // 🔹 Pagination
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = 25; // 25 jobs per page, hard-coded

    // 🔹 Sorting
    let sortOption = {};
    if (sort === "date") sortOption = { postedAt: -1 };
    else if (sort === "salary") sortOption = { salary: -1 };
    else sortOption = { postedAt: -1 }; // default

    const total = await Job.countDocuments(mongoQuery);

    const jobs = await Job.find(mongoQuery)
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const withId = jobs.map((job) => ({
      ...job,
      id: job._id.toString(),
    }));

    res.json({
      jobs: withId,
      total,
      page: pageNum,
      totalPages: Math.max(Math.ceil(total / limitNum), 1),
    });
  } catch (err) {
    console.error("Error in /api/jobs/search:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/jobs/:id
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({
      ...job,
      id: job._id.toString(),
    });
  } catch (err) {
    console.error("Error in /api/jobs/:id:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
