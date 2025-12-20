import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PianoPage from "./pages/PianoPage";
import DrumPage from "./pages/DrumPage";
import SamplerPage from "./pages/SamplerPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default to piano (no more separate homepage) */}
        <Route path="/" element={<Navigate to="/piano" replace />} />

        {/* Instruments */}
        <Route path="/piano" element={<PianoPage />} />
        <Route path="/drum" element={<DrumPage />} />

        {/* Plain sampler (currently a copy of drums UI) */}
        <Route path="/sampler" element={<SamplerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
