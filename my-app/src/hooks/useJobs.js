// src/hooks/useJobs.js
import { useState } from "react";
import { searchJobs } from "../api/jobsApi";

export default function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastFilters, setLastFilters] = useState({});

  async function search(filters = {}, pageToLoad = 1) {
    setLoading(true);
    setError(null);

    const limit = 25; // jobs per page

    try {
      const data = await searchJobs({
        ...filters,
        page: pageToLoad,
        limit,
      });

      // If backend returns array (non-paginated), still handle it
      const results = Array.isArray(data) ? data : data.jobs || [];

      setJobs(results);
      setPage(data.page || pageToLoad);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || results.length);
      setLastFilters(filters);
    } catch (err) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  function goToPage(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    search(lastFilters, newPage);
  }

  return {
    jobs,
    loading,
    error,
    search,
    page,
    totalPages,
    total,
    goToPage,
  };
}
