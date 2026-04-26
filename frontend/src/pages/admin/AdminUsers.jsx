import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const API = API_BASE_URL;

export default function AdminUsers() {
  const { token } = useAuth();
  const [role, setRole] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    axios
      .get(`${API}/admin/users`, {
        params: role ? { role } : {},
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setRows(res.data || []))
      .catch(() => setRows([]));
  }, [role, token]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-100">User Management</h1>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-sm text-neutral-100"
      >
        <option value="">All roles</option>
        <option value="admin">Admin</option>
        <option value="buyer">Buyer</option>
        <option value="seller">Seller</option>
        <option value="user">User</option>
      </select>
      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {rows.map((u) => (
              <tr key={u._id}>
                <td className="px-4 py-3 text-neutral-100">{u.name}</td>
                <td className="px-4 py-3 text-neutral-300">{u.email}</td>
                <td className="px-4 py-3 text-neutral-300">{u.role}</td>
                <td className="px-4 py-3 text-neutral-300">{u.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
