import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "buyer",
    adminCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminField, setShowAdminField] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all required fields");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(
        form.name,
        form.email,
        form.password,
        form.role,
        form.adminCode,
      );
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon auth-logo-icon--register">
            <UserPlus size={24} />
          </div>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Join TradeAI and start trading smarter</p>
        </div>

        {/* Error */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="reg-name" className="auth-label">Full name</label>
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="reg-email" className="auth-label">Email</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              className="auth-input"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reg-role" className="auth-label">Account type</label>
            <select
              id="reg-role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className="auth-input"
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-password" className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <input
                id="reg-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-confirm" className="auth-label">Confirm password</label>
            <input
              id="reg-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={handleChange}
              className="auth-input"
            />
          </div>

          {/* Admin code toggle */}
          {!showAdminField ? (
            <button
              type="button"
              className="auth-admin-toggle"
              onClick={() => setShowAdminField(true)}
            >
              <ShieldCheck size={14} />
              <span>I have an admin invite code</span>
            </button>
          ) : (
            <div className="auth-field">
              <label htmlFor="reg-admin" className="auth-label">
                <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                Admin invite code
              </label>
              <input
                id="reg-admin"
                name="adminCode"
                type="text"
                placeholder="Enter invite code"
                value={form.adminCode}
                onChange={handleChange}
                className="auth-input auth-input--admin"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-ui btn-primary auth-submit auth-submit--ui"
          >
            {loading ? (
              <span className="auth-spinner-sm" />
            ) : (
              <>
                Create account
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
