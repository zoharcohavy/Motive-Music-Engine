// server/scrapers/indeedScraper.js
import axios from "axios";
import * as cheerio from "cheerio";

const INDEED_BASE_URL = "https://www.indeed.com/jobs";

function buildSearchUrl({ query, location, start = 0 }) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  if (location) params.set("l", location);
  if (start > 0) params.set("start", String(start)); // pagination: 0, 10, 20...

  return `${INDEED_BASE_URL}?${params.toString()}`;
}

// Convert strings like "3 days ago", "30+ days ago", "Just posted" into a Date
function parseRelativeDate(text) {
  if (!text) return new Date();

  const lower = text.toLowerCase().trim();
  const now = new Date();

  if (lower.includes("today") || lower.includes("just posted")) {
    return now;
  }

  const match = lower.match(/(\d+)\+?\s*(day|week|month|hour)/);
  if (!match) return now;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const d = new Date(now);

  if (unit === "day") d.setDate(d.getDate() - value);
  else if (unit === "week") d.setDate(d.getDate() - value * 7);
  else if (unit === "month") d.setMonth(d.getMonth() - value);
  else if (unit === "hour") d.setHours(d.getHours() - value);

  return d;
}

export async function scrapeIndeedJobs({
  query,
  location,
  maxPages = 1,
  limit = 50,
}) {
  const jobs = [];

  for (let page = 0; page < maxPages; page++) {
    if (jobs.length >= limit) break;

    const start = page * 10; // Indeed usually shows 10 jobs per page
    const url = buildSearchUrl({ query, location, start });

    console.log(`🔎 Scraping Indeed: ${url}`);

    const response = await axios.get(url, {
      headers: {
        // Pretend to be a browser to avoid basic blocking
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // Each job card
    $(".job_seen_beacon").each((_, el) => {
      if (jobs.length >= limit) return false; // break out of loop

      const title = $(el).find("h2.jobTitle span").last().text().trim();
      const company = $(el).find(".companyName").text().trim();
      const locationText = $(el).find(".companyLocation").text().trim();
      const summary = $(el)
        .find(".job-snippet")
        .text()
        .replace(/\s+/g, " ")
        .trim();
      const dateText = $(el).find("span.date").text().trim();

      const postedAt = parseRelativeDate(dateText);

      if (!title || !company) {
        return; // skip incomplete cards
      }

      jobs.push({
        title,
        company,
        location: locationText || "Remote",
        jobType: "full-time", // default – Indeed doesn't always expose this cleanly
        experience: "entry", // default guess
        summary,
        description: summary,
        postedAt,
      });
    });
  }

  console.log(`✅ Scraped ${jobs.length} jobs from Indeed`);
  return jobs;
}
