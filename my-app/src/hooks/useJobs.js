import { useState } from 'react'
import { searchJobs} from "../api/jobsApi"


export default function useJobs(){
const [jobs, setJobs] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)


async function search(filters){
setLoading(true)
setError(null)
try{
const data = await searchJobs(filters)
setJobs(data || [])
}catch(err){
setError(err.message)
}finally{
setLoading(false)
}
}


return { jobs, loading, error, search }
}