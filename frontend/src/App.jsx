import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import CommodityTrends from "./pages/CommodityTrends";
import ComparativeAnalysis from "./pages/ComparativeAnalysis";
import Alerts from "./pages/Alerts";
import Orders from "./pages/Orders";
import RiskScorePanel from "./components/RiskScorePanel";
import RiskBreakdownPanel from "./components/RiskBreakdownPanel";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Premium from "./pages/Premium";
import Simulation from "./pages/Simulation";
import Forecasts from "./pages/Forecasts";
import Advisory from "./pages/Advisory";


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
            <Route path="/orders" element={<Orders />} />
            <Route path="/risk" element={<RiskScorePanel />} />
            <Route path="/risk/breakdown" element={<RiskBreakdownPanel />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/sim" element={<Simulation />} />
            <Route path="/forecasts" element={<Forecasts />} />
            <Route path="/advisory" element={<Advisory />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
