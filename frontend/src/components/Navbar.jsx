import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";
import {
  BarChart2, TrendingUp, GitCompare, Bell, Package, Shield,
  ClipboardList, Sparkles, Calculator, LineChart as LineChartIcon,
  Lightbulb, LogOut, ShieldCheck
} from "lucide-react";

const API = API_BASE_URL;

function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth(); // Now we use this to conditionalize the UI!
  const [hasAnomalies, setHasAnomalies] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 1. Split your links into Public and Private
  const publicLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <BarChart2 size={16} /> },
    { to: "/commodities", label: "Commodities", icon: <TrendingUp size={16} /> },
  ];

  const privateLinks = [
    { to: "/compare", label: "Compare", icon: <GitCompare size={16} /> },
    { to: "/forecasts", label: "Forecasts", icon: <LineChartIcon size={16} /> },
    { to: "/advisory", label: "Advisory", icon: <Lightbulb size={16} /> },
    { to: "/sim", label: "Simulate", icon: <Calculator size={16} /> },
    { to: "/orders", label: "Marketplace", icon: <Package size={16} /> },
    { to: "/risk", label: "Risk score", icon: <Shield size={16} /> },
    { to: "/risk/breakdown", label: "Risk explain", icon: <ClipboardList size={16} /> },
    { to: "/premium", label: "Premium", icon: <Sparkles size={16} /> },
  ];

  // Combine them based on auth status
  const displayLinks = user ? [...publicLinks, ...privateLinks] : publicLinks;

  // 2. Only poll for anomalies IF the user is logged in
  useEffect(() => {
    if (!user) return; // Prevent 401 errors for public users

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
  }, [user]);

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
        <span className="text-neutral-500 text-sm hidden sm:inline-block">Global Trade Analytics</span>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        
        {/* Render the appropriate links */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          {displayLinks.map((link) => (
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
        </div>

        <div className="w-px h-5 bg-[#2a2a2a] hidden md:block" />

        {/* 3. Conditional Right-Side Menu (Logged in vs Logged out) */}
        {user ? (
          <>
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
                className="nav-user-btn flex items-center gap-2 hover:opacity-80 transition-opacity"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#8ab4ff] font-medium text-sm">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-sm font-medium text-neutral-200 leading-tight">{user?.name || "User"}</span>
                  {user?.role === "admin" && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 leading-tight">
                      <ShieldCheck size={10} /> Admin
                    </span>
                  )}
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-48 bg-[#121212] border border-[#2a2a2a] rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-[#2a2a2a] mb-1">
                    <p className="text-sm font-medium text-neutral-100 truncate">{user?.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                  </div>
                  <button 
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#1a1a1a] flex items-center gap-2 transition-colors" 
                    onClick={logout}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Logged Out Actions */
          <div className="flex items-center gap-3">
            <Link 
              to="/login" 
              className="text-sm font-medium text-neutral-300 hover:text-white transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link 
              to="/register" 
              className="text-sm font-medium bg-[#8ab4ff] text-[#0a0a0a] hover:bg-[#a1c4ff] transition-colors px-4 py-2 rounded-lg"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;