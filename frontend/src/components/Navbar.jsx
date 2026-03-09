import { Link, useLocation } from "react-router-dom";
import { BarChart2, TrendingUp } from "lucide-react";

function Navbar() {
  const location = useLocation();

  const links = [
    { to: "/dashboard", label: "Dashboard", icon: <BarChart2 size={16} /> },
    {
      to: "/commodities",
      label: "Commodities",
      icon: <TrendingUp size={16} />,
    },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
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
      </div>
    </nav>
  );
}

export default Navbar;
