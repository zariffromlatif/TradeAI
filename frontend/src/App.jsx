import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import CommodityTrends from "./pages/CommodityTrends";
import ComparativeAnalysis from "./pages/ComparativeAnalysis"; //n
import Alerts from "./pages/Alerts";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/commodities" element={<CommodityTrends />} />
            <Route path="/compare" element={<ComparativeAnalysis />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
