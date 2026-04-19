import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
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

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes — no navbar */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes — with navbar */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
              <Navbar />
              <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
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
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
