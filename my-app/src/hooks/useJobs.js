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
    try {
      setLoading(true);
      setError(null);

      const mergedFilters = {
        ...filters,
        page: pageToLoad,
      };

      const data = await searchJobs(mergedFilters);

      setJobs(data.jobs || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setLastFilters(filters);
    } catch (err) {
      console.error("Error searching jobs:", err);
      setError(err.message || "Failed to load jobs");
      setJobs([]);
      setTotal(0);
      setTotalPages(1);
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
