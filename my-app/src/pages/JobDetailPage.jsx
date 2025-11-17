import { useParams } from 'react-router-dom'


export default function JobDetailPage() {
const { id } = useParams()


return (
<div className="page-container">
<h2>Job detail</h2>
<p>Job ID: {id}</p>
<p>Hook this up to your backend to fetch job details by id.</p>
</div>
)
}