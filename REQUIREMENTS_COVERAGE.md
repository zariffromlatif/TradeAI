# Functional requirements — coverage checklist

This document maps the **16 functional requirements** (Modules 1–4) to the current TradeAI implementation. Status meanings:

- **Met** — Delivers the requirement in substance for a demo/course scope.
- **Partial** — Implemented but narrower than the written spec, or uses an agreed proxy.
- **Gap** — Missing or not exposed in the product UI/API as specified.

_Last reviewed with the codebase (Express, React, ML service, Mongo)._

---

## Module 1 — Trade intelligence & data management

| # | Requirement (summary) | Status | Notes / where to look |
|---|-------------------------|--------|------------------------|
| **1** | Integrated trade analytics dashboard (country import/export rankings) | **Met** | `frontend/src/pages/Dashboard.jsx`, `GET /api/analytics/dashboard` |
| **2** | Commodity price trend visualization | **Met** | `frontend/src/pages/CommodityTrends.jsx`, `GET /api/commodities/:id` (`priceHistory`) |
| **3** | Trade balance time-series by region | **Partial** | **API:** `GET /api/analytics/trade-balance` (`region` query). **Gap:** no dedicated frontend page/chart consuming this endpoint. |
| **4** | Comparative intelligence (dual country + commodity) | **Partial** | `ComparativeAnalysis.jsx`, `GET /api/analytics/compare` — strong on **trade value** time series; **pricing** side-by-side is not a separate price series (values only). |
| **5** | Payment gateway, tier updates, digital receipts | **Partial** | **Stripe** (test) + webhook / `DEMO_PAYMENT` demo path; `User.tier` updates. In-app **receipt** generation/storage not implemented; spec SSLCommerz vs Stripe documented in README. |
| **6** | Core dataset CRUD (countries, commodities, trade) for admins | **Met** | JWT **admin** on writes; `routes/countries.js`, `commodities.js`, `trade.js` |

---

## Module 2 — Prediction & risk analytics

| # | Requirement (summary) | Status | Notes / where to look |
|---|-------------------------|--------|------------------------|
| **7** | Dual-factor predictive engine (trade volume + **FX** volatility) | **Met** | **Volume:** `POST /api/analytics/forecast/volume` + ML `POST /api/forecast/trade-volume`, UI `/forecasts`. **Volatility:** real FX log-return volatility from synced `FxRate.history` via `POST /api/analytics/forecast/price-volatility` (`fxPair`). |
| **8** | Automated country risk scoring | **Partial** | ML + Express bridge; indicators fed from DB are **limited** (e.g. inflation, trade balance, placeholder GDP) vs “full macro + trade stability + real-time market.” |
| **9** | Risk interpretability panel | **Met** | `RiskScorePanel.jsx`, `RiskBreakdownPanel.jsx`, `POST /api/analytics/risk/:country/breakdown` → ML |

---

## Module 3 — Trade operation & decision layer

| # | Requirement (summary) | Status | Notes / where to look |
|---|-------------------------|--------|------------------------|
| **10** | Simulated order workflow (create, modify, track, lifecycle) | **Partial** | **Met:** create, list, **status** updates (`PUT`). **API** has `DELETE`; **UI** has no delete button. |
| **11** | Dynamic profitability simulator (base price, **FX**, tariffs) | **Partial** | `POST /api/sim/profitability` — USD revenue/cost + **tariff**; **no explicit FX fluctuation model** (inputs are USD). |
| **12** | Anomaly & fraud detection on orders | **Met** | `backend/services/orderAnomaly.js`, flagged orders, `/alerts`, Navbar bell — **simulated** anomalies vs historical patterns |

---

## Module 4 — Settlement, reporting & advisory

| # | Requirement (summary) | Status | Notes / where to look |
|---|-------------------------|--------|------------------------|
| **13** | Landed cost & settlement simulation | **Met** | `POST /api/sim/landed-cost`, `Simulation.jsx` |
| **14** | AI-driven advisory (actionable recommendations) | **Partial** | `POST /api/advisory/recommend`, `/advisory` — **rule-based** synthesis of risk + macro + optional price volatility; not LLM/optimizer “execution windows / routing.” |
| **15** | PDF reports (analytics + forecasts + risk) | **Partial** | `GET /api/reports/trade-summary` — **dashboard-style trade summary** PDF; does not yet bundle **forecasts** or **full risk** sections; limited customization. |
| **16** | Real-time risk notification (bell, critical thresholds) | **Partial** | Bell polls **order anomalies** (`GET /api/orders/anomalies`, 30s). **Not** global market risk thresholds or FX volatility alerts. |

---

## Summary counts

| Status   | Count (of 16) |
|----------|----------------|
| Met      | 7 |
| Partial  | 9 |
| Gap (strict) | 0 *if* Partial is accepted; **FR3 UI** is the clearest missing surface |

---

## Pending gaps (recommended backlog)

Ordered by **impact vs effort** for aligning with the written spec.

1. **FR3 — Trade balance UI**  
   - Add a page (or dashboard section) that calls `GET /api/analytics/trade-balance` with **region** (and/or country) and renders a **time-series chart**.

2. **FR11 — FX in profitability**  
   - Add optional **fxRate** (or separate local/USD legs) to `POST /api/sim/profitability` and UI so margins reflect FX movement, not only USD inputs.

3. **FR10 — Order delete in UI**  
   - Wire `DELETE /api/orders/:id` with confirm dialog on `Orders.jsx`.

4. **FR15 — Richer PDF**  
   - Append sections: **one risk summary** (country + score) and/or **one forecast snapshot**; optional query params for country/commodity.

5. **FR16 — Broader alerts (optional)**  
   - Extend bell logic: e.g. poll risk score vs threshold, or surface **high** `priceVolatility` from F7 — or document that **v1 = order anomalies only**.

6. **FR4 — Compare “pricing”**  
   - If required literally: add commodity **price** series overlay or second chart from `priceHistory` alongside trade values.

7. **FR5 — Receipts**  
   - Minimal: email receipt via Stripe settings; or store `session.id` / PDF on success page — only if rubric demands it.

8. **FR8 — Richer risk inputs**  
   - Expand country payload to ML with more indicators from DB or external stubs — polish, not blocking for demo.

---

## Suggested report wording (one paragraph)

*TradeAI implements the majority of the 16 requirements in substance: dashboard, commodity trends, compare tool, secured CRUD, Stripe-based payments with tier updates, risk scoring and interpretability, order simulation with anomaly detection, profitability and landed-cost calculators, rule-based advisory, PDF trade summary, and order-based alerts. Gaps versus strict wording include: no dedicated trade-balance chart UI (API exists), F7 second factor uses commodity price volatility as an FX proxy, profitability omits a separate FX engine, PDF omits bundled forecasts/risk, alerts focus on order anomalies rather than global market thresholds, and comparative pricing is value-based unless extended.*
