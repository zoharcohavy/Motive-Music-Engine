// src/components/SearchBar/SearchBar.jsx
import { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [jobType, setJobType] = useState("any");
  const [experience, setExperience] = useState("any");
  const [datePosted, setDatePosted] = useState("");
  const [sort, setSort] = useState("relevance");

  const handleSubmit = (e) => {
    e.preventDefault();

    const filters = {};
    if (query.trim() !== "") filters.query = query.trim();
    if (jobType !== "any") filters.jobType = jobType;
    if (experience !== "any") filters.experience = experience;
    if (datePosted !== "") filters.datePosted = datePosted;
    if (sort) filters.sort = sort;

    onSearch(filters);
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit} className="search-bar-form">
        <input
          type="text"
          placeholder="Search title, company, keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
        >
          <option value="any">Any type</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
        </select>

        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
        >
          <option value="any">Any level</option>
          <option value="entry">Entry</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
        </select>

        <select
          value={datePosted}
          onChange={(e) => setDatePosted(e.target.value)}
        >
          <option value="">Any time</option>
          <option value="1">Last 24 hours</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>

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
