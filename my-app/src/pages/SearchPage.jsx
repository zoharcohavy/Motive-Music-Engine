import useJobs from "../hooks/useJobs";
import SearchBar from "../components/SearchBar/SearchBar";
import JobCard from "../components/JobCard/JobCard";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const { jobs, loading, error, search } = useJobs();

  function handleSearch(query) {
    search({ query });
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Job Search</h1>

      <SearchBar onSearch={handleSearch} />

      {loading && <p>Loading jobs...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: "1.5rem" }}>
        {jobs.length === 0 ? (
          <p>No jobs yet. Try searching.</p>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
