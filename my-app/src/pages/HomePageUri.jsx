// src/pages/SearchPage.jsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import PianoImg from "../assets/icons/Piano.jpg";

export default function HomePage() {
  return (
    <div className="page-container">
      <img
        style={{
          position: "absolute", 
          width: "150px",
          height: "150px",
          border: "10px solid #000000", 
          borderRadius: "12px", 
          top: "12px",
          right: "100px" }}
        src={PianoImg}
        alt="Italian Trulli"
      />
      <h1>Music Studio</h1>

      <div>
        <p>Welcome! CohavyMusic is here to fit all you music needs</p>
        <br />
        <br />
        <br />
        <p>Explore our many interactive music instruments</p>
      </div>

      <div>
        <Link to="/piano">
          <button>Piano/synth</button>
        </Link>
        <br />
        <Link to="/drum">
          <button>Drums</button>
        </Link>
      </div>

      <br />

      
    </div>
    
  );
}
