
import { Link } from "react-router-dom";

export default function JobCard({ job }) {
  const jobId = job.id || job._id;

  return (
    <article className="job-card">
      <h3>
        <Link to={`/job/${jobId}`}>{job.title}</Link>
      </h3>
      <p className="muted"> {job.company} — {job.location} </p>
      <p className="muted"> {job.summary || job.snippet || job.description?.slice(0, 140) + "..."} </p>
    </article>
  );
}