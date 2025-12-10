import { BrowserRouter, Routes, Route } from "react-router-dom";
import PianoPage from "./pages/PianoPage";
import DrumPage from "./pages/DrumPage";
import HomePageUri from "./pages/HomePageUri";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Your real homepage */}
        <Route path="/" element={<HomePageUri />} />

        {/* Your piano page */}
        <Route path="/piano" element={<PianoPage />} />

        {/* Your drum page */}
        <Route path="/drum" element={<DrumPage />} />


      </Routes>
    </BrowserRouter>
  );
}
