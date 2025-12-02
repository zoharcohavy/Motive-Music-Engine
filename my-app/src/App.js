import { BrowserRouter, Routes, Route } from "react-router-dom";
import ToneTestPage from "./pages/ToneTestPage";
import HomePageUri from "./pages/HomePageUri";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Your real homepage */}
        <Route path="/" element={<HomePageUri />} />

        {/* Your piano page */}
        <Route path="/tone-test" element={<ToneTestPage />} />

      </Routes>
    </BrowserRouter>
  );
}
