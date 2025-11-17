// src/pages/SearchPage.jsx
import useJobs from "../hooks/useJobs";
import SearchBar from "../components/SearchBar/SearchBar";
import { Link } from "react-router-dom";
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

  function handleSearch(filters) {
    // on a new search, always start from page 1
    search(filters, 1);
  }

  const hasJobs = jobs && jobs.length > 0;

  return (
    <div className="search-page" style={{ padding: "2rem" }}>
      <h1>Job Search</h1>

      <SearchBar onSearch={handleSearch} />

      {loading && <p>Loading jobs...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && total > 0 && (
        <p style={{ marginTop: "1rem" }}>
          Showing {jobs.length} of {total} job
          {total !== 1 && "s"} (page {page} of {totalPages})
        </p>
      )}

      {!loading && !error && !hasJobs && (
        <p style={{ marginTop: "1.5rem" }}>
          No jobs found. Try changing filters.
        </p>
      )}

      {hasJobs && (
        <>
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
                      {job.salary ? `$${job.salary.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div
              className="pagination"
              style={{
                marginTop: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
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
