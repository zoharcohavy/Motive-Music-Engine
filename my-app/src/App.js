import { BrowserRouter, Routes, Route } from "react-router-dom";
import SearchPage from "./pages/SearchPage";
import JobDetailPage from "./pages/JobDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/job/:id" element={<JobDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}
