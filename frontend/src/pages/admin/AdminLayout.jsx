import { Link, Outlet, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/datasets", label: "Datasets" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/payments", label: "Payment Requests" },
  { to: "/admin/orders", label: "Orders & Anomalies" },
  { to: "/admin/risk-alerts", label: "Risk & Alerts" },
  { to: "/admin/reports", label: "Reports" },
];

export default function AdminLayout() {
  const location = useLocation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      <aside className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-4 h-fit">
        <h2 className="text-neutral-100 font-semibold mb-3">Admin Panel</h2>
        <div className="space-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-3 py-2 rounded-lg text-sm ${
                location.pathname === link.to
                  ? "bg-[#8ab4ff] text-black"
                  : "text-neutral-300 hover:bg-[#171717]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </aside>
      <section>
        <Outlet />
      </section>
    </div>
  );
}
