# TradeAI — Pending work guidelines (Members B, C & D)

This document is archived planning context from earlier phases. For current implementation status, use `README.md` and `REQUIREMENTS_COVERAGE.md`.

---

## Member B — Visualizer (Frontend / UI)

### Done (reference)

| Feature | Location / API |
| -------- | ---------------- |
| **F1** Dashboard UI / trade rankings | `frontend/src/pages/Dashboard.jsx` — `GET /api/analytics/dashboard` |
| **F2** Commodity price trends | `frontend/src/pages/CommodityTrends.jsx` — `GET /api/commodities`, `GET /api/commodities/:id` |

### Historical pending items (now implemented in main branch)

#### F4 — Comparative intelligence tool

**Goal:** Side-by-side comparison of **two or more countries** (trade volumes/values and/or pricing; optionally risk).

**APIs to use today**

- `GET /api/analytics/country/:code` — totals; append `?monthly=true` for monthly series per country.
- `GET /api/analytics/trade-balance?country=XX` — balance trajectory per country code (optional).

**Gap for “risk compare”**

- ML service exposes `POST /api/risk-score/batch` (up to 20 countries), but **Express does not proxy it yet**. Prefer asking **Member A/C** to add e.g. `POST /api/analytics/risk-score/batch` mirroring other ML proxies. Avoid calling port `8000` directly from the browser in production (CORS, coupling).

**UI sketch**

- New route e.g. `/compare` in `App.jsx`.
- Load countries from `GET /api/countries`; let user pick 2+; `Promise.all` fetches per code.
- Recharts: grouped bars for totals, or dual line charts for monthly series; summary table for KPIs.

#### F16 — Real-time risk notification system (bell)

**Goal:** Bell icon in `Navbar.jsx` with dropdown; surface critical thresholds / anomalies.

**Possible data sources (v1)**

- `GET /api/orders/anomalies` — flagged simulated orders.
- Optional: poll lightweight summary if **Member A** adds e.g. `GET /api/alerts/summary` later.

**Mechanics**

- Poll every 30–60s (`useEffect` + `setInterval`) unless you add WebSockets/SSE later.
- Badge = count of unread or total anomalies; list items in dropdown.

**Security note**

- Public read of anomalies is only acceptable for **local demos**; document that production should gate behind auth.

### Suggested order (Member B)

1. Register new routes in `App.jsx`.
2. Build **Compare** page using existing analytics endpoints.
3. Coordinate **batch risk proxy** if compare includes risk scores.
4. Add **bell + polling** once endpoints are stable.

---

## Member C — Intelligence Lead (ML / DS)

### Done (reference)

| Feature | Location |
| -------- | -------- |
| **F8** Automated risk scoring | `ml-service/main.py` — `POST /api/risk-score`; backend proxies via `GET /api/analytics/risk/:country`, `POST /api/analytics/risk-score` |
| **F9** (ML + API) Interpretability | `POST /api/risk/{code}/breakdown` in ML; `POST /api/analytics/risk/:country/breakdown` in Express |

### Historical pending / partial notes

#### F9 — Risk interpretability in the product (UI wiring)

**Issue:** `RiskScorePanel.jsx` and `RiskBreakdownPanel.jsx` exist under `frontend/src/components/` but **`App.jsx` does not route to them**.

**Actions**

- Add routes (e.g. `/risk`, `/risk/breakdown`) and nav links in `Navbar.jsx`.
- Verify each component’s `API_BASE` / paths match `backend/routes/analytics.js`.
- ML service must be running or calls return 500.

#### Supporting Member B — Batch risk proxy

- Add **`POST /api/analytics/risk-score/batch`** in `analytics.js`: forward body to `ML_BASE/api/risk-score/batch` (same pattern as `risk-score`).

#### F7 — Dual-factor predictive engine

**Goal:** Forecast **commodity trade volumes** and **FX volatility** (or related signal).

**Data**

- Use seeded `TradeRecord` and `Commodity.priceHistory`; add an **FX time series** (static seed, new collection, or external API — **document the source**).

**Deliverables**

- Implemented as `POST /api/forecast/trade-volume` (Feature-AR with uncertainty bands + backtest metrics) and `POST /api/forecast/price-volatility`.
- Proxied via Express under `/api/analytics/...` for a single frontend origin.

#### F14 — AI-driven advisory engine

**Goal:** Structured recommendations (e.g. execution window hints, routing hints) from **rules + model outputs**.

**Approach**

- New endpoint e.g. `POST /api/advisory/recommend` (FastAPI + Express proxy) combining risk score, simple forecasts, and **deterministic rules** with human-readable `reasons[]`.
- Prefer transparent logic over opaque “black box” text for academic/demo credibility.

### Suggested order (Member C)

1. Wire **F9** in the router (with Member B if shared).
2. Implement **batch risk proxy** for comparative UI.
3. **F7** minimal forecasts + proxies.
4. **F14** thin advisory layer on top of risk + forecasts.

---

## Member D — Operations Lead (Fintech / logic)

### Done (reference)

| Feature | Location |
| -------- | -------- |
| **F10** (API) Simulated orders | `backend/routes/orders.js`, `models/Order.js` — CRUD, `GET /api/orders/anomalies` |
| **F5** (partial) Payments | `backend/routes/payment.js` — **Stripe** checkout + webhook → `User.tier` |

### Historical pending notes

#### F10 — End-to-end simulated order **workflow** (UI)

**Goal:** Create, list, and track mock orders; highlight anomalies.

**APIs**

- `GET/POST /api/orders`, `PUT /api/orders/:id`, `GET /api/orders/anomalies`
- Resolve `commodity` and `country` ObjectIds via `GET /api/commodities` and `GET /api/countries`.

**UI**

- New page(s): order form + table; link to anomalies view or filter.

#### F5 — Payment gateway vs spec

- Current repository standard is **Stripe** (test mode supported, plus `DEMO_PAYMENT` for local demos). SSLCommerz is out of scope unless explicitly required.

**Frontend gap**

- Stripe `success_url` / `cancel_url` point to e.g. `/payment/success` and `/payment/cancel`, but **`App.jsx` may lack those routes** — add stub pages or change URLs to existing routes.

#### F11 — Dynamic profitability simulator

**Backend:** e.g. `POST /api/sim/profitability` — inputs: quantity, commodity (→ price), FX rate, tariff %, optional fees; output: margin, revenue, cost breakdown (JSON).

**Frontend:** Form + results card or small chart.

#### F13 — Landed cost & settlement simulation

**Backend:** e.g. `POST /api/sim/landed-cost` — base price + freight + insurance + duty + FX → landed total, per-unit.

**Frontend:** Same app area as F11 (tabs: “Profitability” / “Landed cost”).

#### F15 — Automated intelligence reporting (PDF)

**Options:** Server-side **pdfkit** / **puppeteer**, or client **jsPDF**.

**Backend (typical):** `GET` or `POST` endpoint that aggregates dashboard/country/risk snippets into one PDF stream.

**Frontend:** Download button; handle blob response.

### Suggested order (Member D)

1. **Orders UI** (makes F10 visible end-to-end).
2. **Payment success/cancel** pages + retest Stripe flow.
3. **F11** then **F13** (shared patterns).
4. **F15** PDF last (reuse same metrics as dashboard).

---

## Cross-team coordination

| Need | Primary owner |
|------|----------------|
| New or adjusted REST endpoints for B/C | Member A (or shared backend owner) |
| Batch risk from browser safely | Member C (proxy) + Member B (UI) |
| FX / tariff constants or stored rates | Member D defines; Member A can persist if needed |
| Demo narrative | All: e.g. 2 countries + 1 commodity → dashboard → risk → order → calculator → PDF |

---

## Related files (quick index)

| Area | Paths |
|------|--------|
| Frontend entry / routes | `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx` |
| Risk UI (unwired) | `frontend/src/components/RiskScorePanel.jsx`, `RiskBreakdownPanel.jsx` |
| Analytics & ML bridge | `backend/routes/analytics.js` |
| ML service | `ml-service/main.py` |
| Orders | `backend/routes/orders.js`, `backend/services/orderAnomaly.js` |
| Payments | `backend/routes/payment.js` |

---

