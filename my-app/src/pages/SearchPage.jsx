// src/pages/SearchPage.jsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import useJobs from "../hooks/useJobs";
import SearchBar from "../components/SearchBar/SearchBar";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const {
    jobs,
    loading,
    error,
    search,
    page,
    totalPages,
    total,
    goToPage,
  } = useJobs();

  useEffect(() => {
    // initial load with no filters
    search({}, 1);
  }, []);

  const handleSearch = (filters) => {
    search(filters, 1);
  };

  const pageSize = 25;

  return (
    <div className="page-container">
      <h1>Job Search</h1>

      <SearchBar onSearch={handleSearch} />

      {loading && <p>Loading jobs...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <p className="results-summary">
            {total > 0
              ? `Showing ${Math.min(
                  (page - 1) * pageSize + 1,
                  total
                )}–${Math.min(page * pageSize, total)} of ${total} jobs`
              : "No jobs found. Try changing your filters."}
          </p>

          {jobs.length > 0 && (
            <table
              className="jobs-table"
              style={{
                marginTop: "1.5rem",
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Experience</th>
                  <th>Salary</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const id = job.id || job._id;
                  return (
                    <tr key={id}>
                      <td>
                        <Link to={`/job/${id}`}>{job.title}</Link>
                      </td>
                      <td>{job.company}</td>
                      <td>{job.location}</td>
                      <td>{job.jobType}</td>
                      <td>{job.experience}</td>
                      <td>
                        {job.salary
                          ? `$${job.salary.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
