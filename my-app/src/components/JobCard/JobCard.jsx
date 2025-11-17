import { Link } from 'react-router-dom'


export default function JobCard({ job }){
return (
<article className="job-card">
<h3><Link to={`/job/${job.id}`}>{job.title}</Link></h3>
<p className="muted">{job.company} — {job.location}</p>
<p className="muted">{job.summary || job.snippet}</p>
</article>
)
}