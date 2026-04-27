import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { tierLabel } from "../config/tiers";

const API = API_BASE_URL;

const TIERS = [
  {
    id: "silver",
    name: "Silver",
    blurb: "Included with every account. Core analytics and marketplace access (subject to role).",
    highlight: false,
  },
  {
    id: "gold",
    name: "Gold",
    blurb: "Expanded limits and priority features for growing trade desks.",
    highlight: true,
  },
  {
    id: "diamond",
    name: "Diamond",
    blurb: "Highest tier — full capability where the product defines paid limits.",
    highlight: true,
  },
];

function Premium() {
  const { user, token } = useAuth();
  const [email, setEmail] = useState("");
  const [checkoutTier, setCheckoutTier] = useState("gold");
  const [demoTier, setDemoTier] = useState("gold");
  const [error, setError] = useState("");
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.email && !email) setEmail(user.email);
  }, [user, email]);

  const runStripeCheckout = async (e) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Please sign in to continue.");
      return;
    }
    if (user?.tier === checkoutTier || (checkoutTier === "gold" && user?.tier === "diamond")) {
      setError("You already meet or exceed this plan.");
      return;
    }
    setLoadingStripe(true);
    try {
      const res = await axios.post(
        `${API}/payment/create-session`,
        { tier: checkoutTier, email },
        { headers: { Authorization: `Bearer ${token}` } },
      );
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
    setDemoMessage("");
    if (!token) {
      setError("Please sign in to use demo upgrade.");
      return;
    }
    setLoadingDemo(true);
    try {
      await axios.post(
        `${API}/payment-requests`,
        {
          amount: 0,
          currency: "USD",
          note: `Demo upgrade request to ${demoTier}.`,
          requestTierUpgrade: true,
          requestedTier: demoTier,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setDemoMessage(
        "Request submitted. Tier will upgrade only after admin approval in Payment Requests.",
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Request failed.");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Plans</h1>
        <p className="text-neutral-400 text-sm mt-2 max-w-2xl">
          <strong className="text-neutral-300">Silver</strong> is the free baseline.
          <strong className="text-neutral-300"> Gold</strong> and{" "}
          <strong className="text-neutral-300">Diamond</strong> are paid upgrades.
          Roles (buyer / seller) still control marketplace actions; tiers control plan limits where enforced.
        </p>
        {user?.tier && (
          <p className="text-sm text-emerald-300 mt-2">
            Your current plan: <strong>{tierLabel(user.tier)}</strong>
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border p-5 flex flex-col ${
              t.highlight
                ? "border-[#8ab4ff]/40 bg-[#121212]"
                : "border-[#2a2a2a] bg-[#121212]"
            }`}
          >
            <h2 className="text-lg font-semibold text-neutral-100">{t.name}</h2>
            <p className="text-neutral-500 text-xs mt-2 flex-1">{t.blurb}</p>
            {t.id === "silver" && (
              <p className="text-xs text-neutral-600 mt-4">Default at registration.</p>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
          Pay with Stripe
        </h3>
        <p className="text-neutral-500 text-xs">
          Checkout is tied to your signed-in account. Test card:{" "}
          <code className="text-[#8ab4ff]">4242 4242 4242 4242</code>.
        </p>
        <form onSubmit={runStripeCheckout} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Plan</span>
            <select
              value={checkoutTier}
              onChange={(e) => setCheckoutTier(e.target.value)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
            >
              <option value="gold">Gold</option>
              <option value="diamond">Diamond</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Receipt email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loadingStripe || loadingDemo}
            className="btn-ui btn-primary w-full"
          >
            {loadingStripe ? "Redirecting…" : `Continue to checkout (${tierLabel(checkoutTier)})`}
          </button>
        </form>
      </div>

      <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
          Demo upgrade (local only)
        </h3>
        <p className="text-neutral-500 text-xs">
          Submits a payment request for admin approval.
          Tier changes only after admin approval.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={demoTier}
            onChange={(e) => setDemoTier(e.target.value)}
            className="bg-[#171717] border border-[#2a2a2a] rounded-xl px-3 py-2 text-neutral-100 flex-1"
          >
            <option value="gold">Gold</option>
            <option value="diamond">Diamond</option>
          </select>
          <button
            type="button"
            onClick={handleDemoUpgrade}
            disabled={loadingStripe || loadingDemo}
            className="btn-ui btn-secondary flex-1"
          >
            {loadingDemo ? "Submitting request…" : `Request demo upgrade → ${tierLabel(demoTier)}`}
          </button>
        </div>
        {demoMessage && <p className="text-sm text-emerald-300">{demoMessage}</p>}
      </div>
    </div>
  );
}

export default Premium;
