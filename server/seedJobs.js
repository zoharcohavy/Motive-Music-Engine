import axios from "axios";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import Job from "./models/Job.js";
import "dotenv/config.js";

async function scrapeIndeedJobs(query = "software engineer", location = "Los Angeles, CA") {
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(
    query
  )}&l=${encodeURIComponent(location)}&radius=25`;

  console.log("Fetching:", url);

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const $ = cheerio.load(data);
  const jobs = [];

  $(".job_seen_beacon").each((i, elem) => {
    const title = $(elem).find("h2.jobTitle span").first().text().trim();
    const company = $(elem).find(".companyName").text().trim();
    const location = $(elem).find(".companyLocation").text().trim();
    const summary = $(elem).find(".job-snippet").text().trim();
    const relativeLink = $(elem).find("a").attr("href");
    const link = relativeLink ? `https://www.indeed.com${relativeLink}` : null;

    if (title && company) {
      jobs.push({
        title,
        company,
        location,
        summary,
        link,
      });
    }
  });

  return jobs;
}

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    console.log("Scraping Indeed...");
    const jobs = await scrapeIndeedJobs("software engineer", "Los Angeles, CA");

    console.log(`Scraped ${jobs.length} jobs.`);

    if (jobs.length > 0) {
      await Job.insertMany(jobs);
      console.log("Jobs inserted into DB.");
    } else {
      console.log("No jobs found.");
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
