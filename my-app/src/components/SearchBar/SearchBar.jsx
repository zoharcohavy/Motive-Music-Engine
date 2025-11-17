import { useState } from "react";


export default function SearchBar({ onSearch }) {
const [query, setQuery] = useState("");
const [jobType, setJobType] = useState("");
const [experience, setExperience] = useState("");
const [datePosted, setDatePosted] = useState("");
const [sort, setSort] = useState("relevance");


const handleSubmit = (e) => {
e.preventDefault();


onSearch({
query,
jobType,
experience,
datePosted,
sort,
});
};


return (
<form onSubmit={handleSubmit} className="search-bar">
<div className="sb-row">
<input
type="text"
placeholder="Search jobs (e.g. software engineer)"
value={query}
onChange={(e) => setQuery(e.target.value)}
/>
<button type="submit">Search</button>
</div>


<div className="sb-filters">
<select value={jobType} onChange={(e) => setJobType(e.target.value)}>
<option value="">Job Type</option>
<option value="fulltime">Full-Time</option>
<option value="parttime">Part-Time</option>
<option value="contract">Contract</option>
<option value="internship">Internship</option>
</select>


<select value={experience} onChange={(e) => setExperience(e.target.value)}>
<option value="">Experience</option>
<option value="entry">Entry Level</option>
<option value="mid">Mid Level</option>
<option value="senior">Senior Level</option>
</select>


<select value={datePosted} onChange={(e) => setDatePosted(e.target.value)}>
<option value="">Date Posted</option>
<option value="1">Past 24 hours</option>
<option value="3">Last 3 days</option>
<option value="7">Last 7 days</option>
</select>


<select value={sort} onChange={(e) => setSort(e.target.value)}>
<option value="relevance">Sort: Relevance</option>
<option value="date">Sort: Newest</option>
<option value="salary">Sort: Salary</option>
</select>
</div>
</form>
);
}