// server/routes/jobs.js
import express from "express";
import Job from "../models/Job.js";

const router = express.Router();

/**
 * GET /api/jobs/search
 * Query params:
 *  - query: text search (title/company/location/summary/description)
 *  - jobType: "full-time" | "part-time" | "contract"
 *  - experience: "entry" | "mid" | "senior"
 *  - datePosted: number of days back (e.g. 7 = last week)
 *  - sort: "relevance" | "date" | "salary"
 *  - page: 1-based page index
 */
router.get("/search", async (req, res) => {
  try {
    const {
      query,
      jobType,
      experience,
      datePosted,
      sort = "relevance",
      page = "1",
    } = req.query;

    const mongoQuery = {};

    // Text search
    if (query && query.trim() !== "") {
      const regex = new RegExp(query.trim(), "i");
      mongoQuery.$or = [
        { title: regex },
        { company: regex },
        { location: regex },
        { summary: regex },
        { description: regex },
      ];
    }

    // Job type filter
    if (jobType && jobType !== "any") {
      mongoQuery.jobType = jobType;
    }

    // Experience filter
    if (experience && experience !== "any") {
      mongoQuery.experience = experience;
    }

    // Posted within last X days
    if (datePosted) {
      const days = parseInt(datePosted, 10);
      if (!Number.isNaN(days)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        mongoQuery.postedAt = { $gte: cutoff };
      }
    }

    // Pagination: 25 per page
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = 25;
    const skip = (pageNum - 1) * pageSize;

    // Sorting
    let sortOption = {};
    if (sort === "date") sortOption = { postedAt: -1 };
    else if (sort === "salary") sortOption = { salary: -1 };
    else sortOption = { createdAt: -1 }; // "relevance" fallback

    const [jobs, total] = await Promise.all([
      Job.find(mongoQuery)
        .sort(sortOption)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Job.countDocuments(mongoQuery),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    const jobsWithId = jobs.map((job) => ({
      ...job,
      id: job._id.toString(),
    }));

    res.json({
      jobs: jobsWithId,
      page: pageNum,
      totalPages,
      total,
      pageSize,
    });
  } catch (err) {
    console.error("Error in GET /api/jobs/search:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/jobs/:id
 * Single job detail
 */
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
    console.error("Error in GET /api/jobs/:id:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
