import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:5000/api";

function Premium() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingStripe(true);
    try {
      const res = await axios.post(`${API}/payment/create-session`, {
        userId,
        email,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError("No checkout URL returned.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed.");
    } finally {
      setLoadingStripe(false);
    }
  };

  const handleDemoUpgrade = async () => {
    setError("");
    if (!userId.trim()) {
      setError("Enter your MongoDB user ID.");
      return;
    }
    setLoadingDemo(true);
    try {
      await axios.post(`${API}/payment/demo-upgrade`, { userId: userId.trim() });
      navigate("/payment/success");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed.");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Upgrade to Premium</h1>
      <p className="text-neutral-400 text-sm space-y-2">
        <span className="block">
          <strong className="text-neutral-300">Demo:</strong> upgrade without Stripe
          if <code className="text-[#8ab4ff]">DEMO_PAYMENT=true</code> in{" "}
          <code className="text-[#8ab4ff]">backend/.env</code> (restart server).
        </span>
        <span className="block">
          <strong className="text-neutral-300">Stripe:</strong> use MongoDB{" "}
          <code className="text-[#8ab4ff]">users._id</code> and account email.
          Test card:{" "}
          <code className="text-[#8ab4ff]">4242 4242 4242 4242</code>.
        </span>
      </p>
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <form
        onSubmit={handleCheckout}
        className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">User ID (MongoDB)</span>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            placeholder="64a..."
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            required
          />
        </label>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDemoUpgrade}
            disabled={loadingStripe || loadingDemo}
            className="btn-ui btn-secondary w-full"
          >
            {loadingDemo ? "Upgrading…" : "Simulate premium (demo)"}
          </button>
          <button
            type="submit"
            disabled={loadingStripe || loadingDemo}
            className="btn-ui btn-primary w-full"
          >
            {loadingStripe ? "Redirecting…" : "Pay with Stripe"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Premium;
