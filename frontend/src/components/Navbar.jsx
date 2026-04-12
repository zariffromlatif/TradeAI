import { Link, useLocation } from "react-router-dom";
import { BarChart2, TrendingUp, GitCompare, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:5000/api";

function Navbar() {
  const location = useLocation();
  const [hasAnomalies, setHasAnomalies] = useState(false);

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: <BarChart2 size={16} /> },
    {
      to: "/commodities",
      label: "Commodities",
      icon: <TrendingUp size={16} />,
    },
    {
      to: "/compare",
      label: "Compare",
      icon: <GitCompare size={16} />,
    },
  ];

  // Poll every 30 seconds just to check if the red badge should be visible
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

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 font-bold text-xl">TradeAI</span>
        <span className="text-gray-500 text-sm">Global Trade Analytics</span>
      </div>
      
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              location.pathname === link.to
                ? "text-emerald-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}

        <div className="w-px h-5 bg-gray-800"></div>

        {/* Dedicated Alerts Page Link */}
        <Link
          to="/alerts"
          className={`relative p-2 transition-colors rounded-lg ${
            location.pathname === "/alerts"
              ? "text-emerald-400 bg-gray-800"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
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
      </div>
    </nav>
  );
}

export default Navbar;