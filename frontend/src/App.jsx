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
import SensitivityAnalysis from "./pages/SensitivityAnalysis";
import TradeBalance from "./pages/TradeBalance";
import PaymentRequests from "./pages/PaymentRequests";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDatasets from "./pages/admin/AdminDatasets";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminOrdersAnomalies from "./pages/admin/AdminOrdersAnomalies";
import AdminRiskAlerts from "./pages/admin/AdminRiskAlerts";
import AdminReports from "./pages/admin/AdminReports";

// Extract the layout so we can reuse it for both Public and Private routes
const MainLayout = ({ children }) => (
  <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
    <Navbar />
    <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
      {children}
    </main>
  </div>
);

function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes — entirely separate, no navbar */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* PUBLIC ROUTES — Has Navbar, NO ProtectedRoute */}
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
      <Route path="/commodities" element={<MainLayout><CommodityTrends /></MainLayout>} />
      <Route path="/trade-balance" element={<MainLayout><TradeBalance /></MainLayout>} />

      {/* PRIVATE ROUTES — Has Navbar AND is wrapped in ProtectedRoute */}
      <Route path="/compare" element={<ProtectedRoute><MainLayout><ComparativeAnalysis /></MainLayout></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><MainLayout><Alerts /></MainLayout></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><MainLayout><Orders /></MainLayout></ProtectedRoute>} />
      <Route path="/simulation" element={<Simulation />} />
      <Route path="/risk" element={<ProtectedRoute><MainLayout><RiskScorePanel /></MainLayout></ProtectedRoute>} />
      <Route path="/risk/breakdown" element={<ProtectedRoute><MainLayout><RiskBreakdownPanel /></MainLayout></ProtectedRoute>} />
      <Route path="/sim" element={<ProtectedRoute><MainLayout><Simulation /></MainLayout></ProtectedRoute>} />
      <Route path="/sensitivity" element={<ProtectedRoute><MainLayout><SensitivityAnalysis /></MainLayout></ProtectedRoute>} />
      <Route path="/forecasts" element={<ProtectedRoute><MainLayout><Forecasts /></MainLayout></ProtectedRoute>} />
      <Route path="/advisory" element={<ProtectedRoute><MainLayout><Advisory /></MainLayout></ProtectedRoute>} />
      <Route path="/premium" element={<ProtectedRoute><MainLayout><Premium /></MainLayout></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute><MainLayout><Premium /></MainLayout></ProtectedRoute>} />
      <Route path="/payment-requests" element={<ProtectedRoute><MainLayout><PaymentRequests /></MainLayout></ProtectedRoute>} />
      <Route path="/payment/success" element={<ProtectedRoute><MainLayout><PaymentSuccess /></MainLayout></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><MainLayout><PaymentCancel /></MainLayout></ProtectedRoute>} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <MainLayout>
              <AdminLayout />
            </MainLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="datasets" element={<AdminDatasets />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="orders" element={<AdminOrdersAnomalies />} />
        <Route path="risk-alerts" element={<AdminRiskAlerts />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>
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