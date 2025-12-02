// src/pages/SearchPage.jsx
import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function HomePage() {


  

  return (
    <div className="page-container">
      <h1>Music Studio</h1>
       <div style={{ marginBottom: "1rem" }}>
        <p>Welcome! CohavyMusic is here to fit all you music needs</p>
        <br></br>
        <br></br>
        <br></br>
         <p>Explore our many interactive music instruments</p>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/tone-test">
          <button>Play instruments</button>
        </Link>
        </div>
        <br></br>
         <div style={{ marginBottom: "1rem" }}>
     
       <div style={{ marginBottom: "1rem" }}>
        {/* <Link to="/search-page">
          <button>Go to Search Page for Jobs</button>
        </Link> */}
      </div>
    </div>
    </div>
  );
}
