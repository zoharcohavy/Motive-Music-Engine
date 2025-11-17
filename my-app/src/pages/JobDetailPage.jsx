// src/pages/JobDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchJobById } from "../api/jobsApi";
import "../styles/JobDetailPage.css";

export default function JobDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchJobById(id);
        setJob(data);
      } catch (err) {
        console.error("Error loading job:", err);
        setError("Failed to load job details");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="page-container">
        <p>Loading job...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <p>Job not found.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Link to="/">&larr; Back to search</Link>

      <h2>{job.title}</h2>
      <p>
        <strong>Company:</strong> {job.company}
      </p>
      <p>
        <strong>Location:</strong> {job.location}
      </p>
      <p>
        <strong>Type:</strong> {job.jobType}
      </p>
      <p>
        <strong>Experience:</strong> {job.experience}
      </p>
      {job.salary && (
        <p>
          <strong>Salary:</strong> ${job.salary.toLocaleString()}
        </p>
      )}

      {job.summary && <p>{job.summary}</p>}

      {job.description && (
        <>
          <h3>Description</h3>
          <p>{job.description}</p>
        </>
      )}
    </div>
  );
}
