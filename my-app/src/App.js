import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import InstrumentPage from "./pages/InstrumentPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default to piano (no more separate homepage) */}
        <Route path="/" element={<Navigate to="/piano" replace />} />

        {/* Instruments */}
        <Route path="/piano" element={<InstrumentPage instrument="piano" />} />
        <Route path="/drum" element={<InstrumentPage instrument="drums" />} />
        <Route path="/sampler" element={<InstrumentPage instrument="sampler" />} />

      </Routes>
    </BrowserRouter>
  );
}
