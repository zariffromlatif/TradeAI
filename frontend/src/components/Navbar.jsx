import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";
import { tierLabel } from "../config/tiers";
import {
  BarChart2, TrendingUp, GitCompare, Bell, Package, Shield,
  ClipboardList, Sparkles, Calculator, LineChart as LineChartIcon,
  Lightbulb, LogOut, ShieldCheck, Activity, ChevronDown, MoreHorizontal,
  Menu, X
} from "lucide-react";

const API = API_BASE_URL;

function Navbar() {
  const location = useLocation();
  const { user, token, logout } = useAuth(); 
  const [hasAnomalies, setHasAnomalies] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const publicLinks = [
    { to: "/dashboard", label: "Dashboard", icon: <BarChart2 size={16} /> },
    { to: "/commodities", label: "Commodities", icon: <TrendingUp size={16} /> },
    { to: "/trade-balance", label: "Balance", icon: <Activity size={16} /> },
  ];

  const privateLinks = [
    { to: "/compare", label: "Compare", icon: <GitCompare size={16} /> },
    { to: "/forecasts", label: "Forecasts", icon: <LineChartIcon size={16} /> },
    { to: "/advisory", label: "Advisory", icon: <Lightbulb size={16} /> },
    { to: "/sim", label: "Simulate", icon: <Calculator size={16} /> },
    { to: "/orders", label: "Marketplace", icon: <Package size={16} /> },
    { to: "/payment-requests", label: "Payments", icon: <Sparkles size={16} /> },
  ];

  const moreLinks = [
    { to: "/risk", label: "Risk score", icon: <Shield size={16} /> },
    { to: "/risk/breakdown", label: "Risk explain", icon: <ClipboardList size={16} /> },
    { to: "/sensitivity", label: "Stress Test", icon: <Activity size={16} /> },
    { to: "/plans", label: "Plans", icon: <Sparkles size={16} /> },
    { to: "/admin", label: "Admin", icon: <ShieldCheck size={16} /> },
  ];
  const filteredMoreLinks = moreLinks.filter(
    (link) => link.to !== "/admin" || user?.role === "admin",
  );

  const plansPaths = ["/plans", "/premium"];
  const isPlansRoute = () => plansPaths.includes(location.pathname);

  const displayLinks = user ? [...publicLinks, ...privateLinks] : publicLinks;

  useEffect(() => {
    if (!user) return; 

    const checkAnomalies = async () => {
      try {
        const [anomalyRes, riskRes] = await Promise.all([
          axios.get(`${API}/orders/anomalies`),
          axios.get(`${API}/risk-alerts/active`, {
            headers: user ? { Authorization: `Bearer ${localStorage.getItem("tradeai_token")}` } : {},
          }),
        ]);
        const notifRes = await axios.get(`${API}/notifications/mine`, {
          headers: user ? { Authorization: `Bearer ${localStorage.getItem("tradeai_token")}` } : {},
        });
        const unread = (notifRes.data || []).filter((n) => !n.read).length;
        setHasAnomalies(
          (anomalyRes.data?.length || 0) > 0 ||
            (riskRes.data?.length || 0) > 0 ||
            unread > 0,
        );
      } catch (err) {
        console.error("Failed to fetch anomalies:", err);
      }
    };

    checkAnomalies();
    const intervalId = setInterval(checkAnomalies, 30000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    if (!user || !token) return undefined;
    const socketBase = API_BASE_URL.replace(/\/api$/, "");
    const socket = io(socketBase, {
      transports: ["websocket"],
      auth: { token },
    });
    const onAnyAlert = () => setHasAnomalies(true);
    socket.on("payment_status_change", onAnyAlert);
    socket.on("order_anomaly_review", onAnyAlert);
    socket.on("risk_alerts_created", onAnyAlert);
    socket.on("thresholds_updated", onAnyAlert);
    socket.on("order_transitioned", onAnyAlert);
    return () => {
      socket.off("payment_status_change", onAnyAlert);
      socket.off("order_anomaly_review", onAnyAlert);
      socket.off("risk_alerts_created", onAnyAlert);
      socket.off("thresholds_updated", onAnyAlert);
      socket.off("order_transitioned", onAnyAlert);
      socket.disconnect();
    };
  }, [user, token]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".nav-user-menu-wrap")) setShowUserMenu(false);
      if (!e.target.closest(".nav-more-menu-wrap")) setShowMoreMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#202020] relative">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#8ab4ff] font-semibold tracking-tight text-xl">TradeAI</span>
          <span className="text-neutral-500 text-sm hidden sm:inline-block">Global Trade Analytics</span>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          
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

            {user && (
              <div className="relative nav-more-menu-wrap">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    moreLinks.some(
                      (link) =>
                        location.pathname === link.to ||
                        (link.to === "/plans" && isPlansRoute()),
                    )
                      ? "text-[#8ab4ff]"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  <MoreHorizontal size={16} />
                  More
                  <ChevronDown size={14} className={`transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} />
                </button>

                {showMoreMenu && (
                  <div className="absolute top-full left-0 mt-4 w-48 bg-[#121212] border border-[#2a2a2a] rounded-xl shadow-2xl py-2 z-50">
                    {filteredMoreLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setShowMoreMenu(false)}
                        className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                          location.pathname === link.to ||
                          (link.to === "/plans" && isPlansRoute())
                            ? "text-[#8ab4ff] bg-[#1a1a1a]"
                            : "text-neutral-300 hover:text-neutral-100 hover:bg-[#1a1a1a]"
                        }`}
                      >
                        {link.icon}
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-[#2a2a2a] hidden md:block" />

          {user ? (
            <>
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

              <div className="w-px h-5 bg-[#2a2a2a] hidden md:block" />

              <div className="nav-user-menu-wrap hidden md:block" style={{ position: "relative" }}>
                <button
                  className="nav-user-btn flex items-center gap-2 hover:opacity-80 transition-opacity"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#8ab4ff] font-medium text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="hidden sm:flex flex-col items-start text-left">
                    <span className="text-sm font-medium text-neutral-200 leading-tight">{user?.name || "User"}</span>
                    {user?.tier && (
                      <span className="text-[10px] text-amber-200/90 font-medium leading-tight">
                        {tierLabel(user.tier)}
                      </span>
                    )}
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

              <button 
                className="md:hidden text-neutral-400 hover:text-neutral-100 p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link 
                to="/login" 
                className="text-sm font-medium text-neutral-300 hover:text-white transition-colors px-3 py-2 hidden sm:block"
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
      </div>

      {isMobileMenuOpen && user && (
        <div className="md:hidden border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-4 space-y-2 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center gap-3 p-3 border-b border-[#2a2a2a] mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#8ab4ff] font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-100">{user?.name || "User"}</p>
              <p className="text-xs text-neutral-500">{user?.email}</p>
            </div>
          </div>
          
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-3 pt-2">Main Menu</div>
          {displayLinks.map((link) => (
            <Link
              key={`mobile-${link.to}`}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-[#1a1a1a] text-[#8ab4ff]"
                  : "text-neutral-300 hover:bg-[#1a1a1a]"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}

          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-3 pt-4">More Tools</div>
          {filteredMoreLinks.map((link) => (
            <Link
              key={`mobile-more-${link.to}`}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                location.pathname === link.to ||
                (link.to === "/plans" && isPlansRoute())
                  ? "bg-[#1a1a1a] text-[#8ab4ff]"
                  : "text-neutral-300 hover:bg-[#1a1a1a]"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}

          <div className="pt-4 mt-2 border-t border-[#2a2a2a]">
            <button 
              className="w-full px-3 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-[#1a1a1a] flex items-center gap-3 transition-colors" 
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;