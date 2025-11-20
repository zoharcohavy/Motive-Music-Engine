import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import JobDetailPage from "./pages/JobDetailPage";
import ToneTestPage from "./pages/ToneTestPage"; // ⬅️ NEW
import HomePageUri from "./pages/HomePageUri";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePageUri />} />
        <Route path="/search-page" element={<SearchPage />} />
        <Route path="/job/:id" element={<JobDetailPage />} />
        <Route path="/tone-test" element={<ToneTestPage />} /> {/* ⬅️ NEW */}
      </Routes>
    </BrowserRouter>
  );
}
