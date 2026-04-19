import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";
import {
  BarChart2, TrendingUp, GitCompare, Bell, Package, Shield,
  ClipboardList, Sparkles, Calculator, LineChart as LineChartIcon,
  Lightbulb, LogOut, User, ShieldCheck
} from "lucide-react";

const API = API_BASE_URL;

function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [hasAnomalies, setHasAnomalies] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: <BarChart2 size={16} /> },
    { to: "/commodities", label: "Commodities", icon: <TrendingUp size={16} /> },
    { to: "/compare", label: "Compare", icon: <GitCompare size={16} /> },
    { to: "/forecasts", label: "Forecasts", icon: <LineChartIcon size={16} /> },
    { to: "/advisory", label: "Advisory", icon: <Lightbulb size={16} /> },
    { to: "/sim", label: "Simulate", icon: <Calculator size={16} /> },
    { to: "/orders", label: "Marketplace", icon: <Package size={16} /> },
    { to: "/risk", label: "Risk score", icon: <Shield size={16} /> },
    { to: "/risk/breakdown", label: "Risk explain", icon: <ClipboardList size={16} /> },
    { to: "/premium", label: "Premium", icon: <Sparkles size={16} /> },
  ];

  // Poll every 30 seconds to update anomaly indicator.
  useEffect(() => {
    const checkAnomalies = async () => {
      try {
        const res = await axios.get(`${API}/orders/anomalies`);
        setHasAnomalies(res.data.length > 0);
      } catch (err) {
        console.error("Failed to fetch anomalies:", err);
      }
    };

    checkAnomalies();
    const intervalId = setInterval(checkAnomalies, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (!e.target.closest(".nav-user-menu-wrap")) setShowUserMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showUserMenu]);

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#202020] px-6 py-4 flex items-center justify-between relative">
      <div className="flex items-center gap-2">
        <span className="text-[#8ab4ff] font-semibold tracking-tight text-xl">TradeAI</span>
        <span className="text-neutral-500 text-sm">Global Trade Analytics</span>
      </div>

      <div className="flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              location.pathname === link.to
                ? "text-[#8ab4ff]"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}

        <div className="w-px h-5 bg-[#2a2a2a]" />

        {/* Alerts */}
        <Link
          to="/alerts"
          className={`relative p-2 transition-colors rounded-lg ${
            location.pathname === "/alerts"
              ? "text-[#8ab4ff] bg-[#171717] border border-[#2a2a2a]"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-[#171717]"
          }`}
        >
          <Bell size={20} />
          {hasAnomalies && (
            <span className="absolute top-1 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
        </Link>

        <div className="w-px h-5 bg-[#2a2a2a]" />

        {/* User menu */}
        <div className="nav-user-menu-wrap" style={{ position: "relative" }}>
          <button
            className="nav-user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="nav-user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span className="nav-user-name">{user?.name || "User"}</span>
            {user?.role === "admin" && (
              <span className="nav-role-badge">
                <ShieldCheck size={12} />
                Admin
              </span>
            )}
          </button>

          {showUserMenu && (
            <div className="nav-user-dropdown">
              <div className="nav-dropdown-header">
                <p className="nav-dropdown-name">{user?.name}</p>
                <p className="nav-dropdown-email">{user?.email}</p>
              </div>
              <div className="nav-dropdown-divider" />
              <button className="nav-dropdown-item" onClick={logout}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;