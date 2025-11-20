// src/pages/SearchPage.jsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import useJobs from "../hooks/useJobs";
import SearchBar from "../components/SearchBar/SearchBar";
import "../styles/SearchPage.css";

export default function HomePage() {
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
      <h1>Uri & Zohar's functional Website</h1>
       <div style={{ marginBottom: "1rem" }}>
        <p>Welcome! Use the links below to navigate the site. Options may seem random but are all functional.</p>
         <p>Try and solve the puzzles along the way!</p>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/tone-test">
          <button>Go to 400 Hz Test Tone</button>
        </Link>
      </div>
       <div style={{ marginBottom: "1rem" }}>
        <Link to="/search-page">
          <button>Go to Search Page for Jobs</button>
        </Link>
      </div>

    </div>
  );
}
