// src/api/jobsApi.js
export const searchJobs = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const res = await fetch(
    `http://localhost:8080/api/jobs/search?${params.toString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
};

export const fetchJobById = async (id) => {
  const res = await fetch(`http://localhost:8080/api/jobs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch job");
  return res.json();
};
