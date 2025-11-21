import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import JobDetailPage from "./pages/JobDetailPage";
import ToneTestPage from "./pages/ToneTestPage";
import HomePageUri from "./pages/HomePageUri";
import AudioTapeApp from "./components/AudioTapeApp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Your real homepage */}
        <Route path="/" element={<HomePageUri />} />

        {/* Your job pages */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/job/:id" element={<JobDetailPage />} />

        {/* Your piano page */}
        <Route path="/tone-test" element={<ToneTestPage />} />

        {/* Your NEW audio tape page */}
        <Route path="/tape" element={<AudioTapeApp />} />

      </Routes>
    </BrowserRouter>
  );
}
