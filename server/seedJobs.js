// server/seedJobs.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Job from "./models/Job.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/jobsdb?retryWrites=true&w=majority";

const TITLES = [
  "Junior Frontend Developer",
  "Senior Backend Engineer",
  "Data Analyst",
  "Part-Time QA Tester",
  "DevOps Engineer",
  "Machine Learning Engineer",
  "IT Support Specialist",
  "UI/UX Designer",
  "Full-Stack Developer",
  "Product Manager",
];

const COMPANIES = [
  "TechGen",
  "CloudWorks",
  "Insight Analytics",
  "BugSquashers",
  "DeployHQ",
  "AI Labs",
  "HelpDesk Co",
  "PixelPerfect Studio",
  "StackForge",
  "BrightPath",
];

const LOCATIONS = [
  "Remote",
  "Los Angeles, CA",
  "New York, NY",
  "San Francisco, CA",
  "Boston, MA",
  "Dallas, TX",
  "Seattle, WA",
  "Chicago, IL",
];

const JOB_TYPES = ["full-time", "part-time", "contract"];
const EXPERIENCES = ["entry", "mid", "senior"];

function buildDescription(title, company) {
  return `As a ${title} at ${company}, you will collaborate with a cross-functional team to build, test, and maintain modern applications. You will participate in code reviews, write clean and maintainable code, and help improve existing systems.`;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Job.deleteMany({});
    console.log("🧹 Cleared existing jobs");

    const jobs = [];
    const totalJobs = 200;

    for (let i = 0; i < totalJobs; i++) {
      const title = TITLES[i % TITLES.length];
      const company = COMPANIES[i % COMPANIES.length];
      const location = LOCATIONS[i % LOCATIONS.length];
      const jobType = JOB_TYPES[i % JOB_TYPES.length];
      const experience = EXPERIENCES[i % EXPERIENCES.length];

      const baseSalary =
        experience === "entry"
          ? 55000
          : experience === "mid"
          ? 90000
          : 130000;

      const salary = baseSalary + (i % 10) * 2500; // tiny variation

      const daysAgo = i % 30; // posted within last 30 days
      const postedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      jobs.push({
        title: `${title} #${Math.floor(i / TITLES.length) + 1}`,
        company,
        location,
        jobType,
        experience,
        summary: `${experience.toUpperCase()} level ${jobType} role in ${location}`,
        description: buildDescription(title, company),
        salary,
        postedAt,
      });
    }

    const inserted = await Job.insertMany(jobs);
    console.log(`✅ Inserted ${inserted.length} jobs`);
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

run();
