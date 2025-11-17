import { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [jobType, setJobType] = useState("");
  const [experience, setExperience] = useState("");
  const [datePosted, setDatePosted] = useState("");
  const [sort, setSort] = useState("relevance");

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build a filters object to send to the parent
    const filters = {
      query,
      jobType,
      experience,
      datePosted,
      sort,
    };

    // Call the function from the parent (SearchPage)
    onSearch(filters);
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit}>
        {/* Main search text */}
        <input
          type="text"
          placeholder="Search job titles, companies, or keywords…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Job type filter */}
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
        >
          <option value="">Any type</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
        </select>

        {/* Experience filter */}
        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        >
          <option value="">Any level</option>
          <option value="entry">Entry</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
        </select>

        {/* Date posted filter */}
        <select
          value={datePosted}
          onChange={(e) => setDatePosted(e.target.value)}
        >
          <option value="">Any time</option>
          <option value="1">Past 24 hours</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="date">Sort: Newest</option>
          <option value="salary">Sort: Salary</option>
        </select>

        <button type="submit">Search</button>
      </form>
    </div>
  );
}