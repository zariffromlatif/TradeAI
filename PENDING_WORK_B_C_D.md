# TradeAI — Pending work guidelines (Members B, C & D)

This file is kept for historical tracking. The core B/C/D scope is now implemented; use `README.md` + `REQUIREMENTS_COVERAGE.md` for current source of truth.

---

## Status snapshot (current)

| Area | Done | Still open |
|------|------|------------|
| **Member B** | F1, F2, F4, F16, dashboard empty-state/fallback UX | Optional polish only |
| **Member C** | F8; F9; F7 (Feature-AR volume + real FX); **F14** | — |
| **Member D** | F10 marketplace RFQ + deals + role/ownership authz; F5 Stripe + docs + demo payment; F11; F13; **F15 PDF** | — |

---

## Member B — Visualizer (Frontend / UI)

### Done

| Feature | What shipped |
| -------- | ------------- |
| **F1** | `frontend/src/pages/Dashboard.jsx` — `GET /api/analytics/dashboard` |
| **F2** | `frontend/src/pages/CommodityTrends.jsx` — commodities + price history |
| **F4** | `frontend/src/pages/ComparativeAnalysis.jsx`, route `/compare` in `App.jsx`. Backend: `GET /api/analytics/compare?countryA=&countryB=&type=&commodity=` (dual-country time series + optional commodity filter). Proxy: `POST /api/analytics/risk-score/batch` → ML batch scoring |
| **F16** | `Navbar.jsx`: bell with polling (`GET /api/orders/anomalies` every 30s), badge when anomalies exist. `frontend/src/pages/Alerts.jsx`, route `/alerts` |

### Optional polish (not required for “done”)

- Dropdown from bell (quick preview) in addition to `/alerts` page.
- Auth-gated anomalies in production; document demo vs prod.
### Pending for B

*None on the original four B features.* Future work is integration/testing with `main` and UX tweaks.

---

## Member C — Intelligence Lead (ML / DS)

### Done

| Item | Location |
|------|----------|
| **F8** | `ml-service/main.py` — `POST /api/risk-score`; Express: `GET /api/analytics/risk/:country`, `POST /api/analytics/risk-score` |
| **F9 (ML + API)** | `POST /api/risk/{code}/breakdown` in ML; `POST /api/analytics/risk/:country/breakdown` in Express |
| **Batch risk (for compare / tools)** | `POST /api/analytics/risk-score/batch` proxies to ML |
| **F7** | `POST /api/forecast/trade-volume` (Feature-AR + bands + metrics), `POST /api/forecast/price-volatility` in ML; Express `POST /api/analytics/forecast/volume`, `.../price-volatility`, `GET /api/analytics/fx/pairs`; FX sync script `backend/scripts/syncFxRates.js`; UI `Forecasts.jsx` `/forecasts` |
| **F14** | `POST /api/advisory/recommend`; `services/advisoryRules.js`; `routes/advisory.js`; UI `Advisory.jsx` `/advisory` (Express-only rules; ML for risk score) |

### Pending (Member C)

*None on the original Member C feature list.*

#### F9 / F7 / F14 — status

- **F9, F7:** Done (see table above).
- **F14:** Done — rule-based recommendations from ML risk + country macro + optional commodity price volatility.

---

## Member D — Operations Lead (Fintech / logic)

### Done

| Item | Notes |
|------|-------|
| **F10** | `Orders.jsx` + `/orders`; RFQ board, quote submission, quote acceptance, deal settlement states, anomaly visibility |
| **F5** | Stripe + webhook + `DEMO_PAYMENT` demo upgrade; README: Stripe vs SSLCommerz |
| **F11 / F13** | `simulation.js`, `/sim`, `POST /api/sim/profitability`, `POST /api/sim/landed-cost` |
| **F15** | `GET /api/reports/trade-summary` (pdfkit); dashboard **Download PDF report** |

### Pending

*None on the original Member D list.* Optional: SSLCommerz only if course mandates (repo uses Stripe).

---

## Cross-team notes

| Topic | Note |
|-------|------|
| ML service | Risk and batch endpoints need **`ml-service` on port 8000** or analytics proxies return 500. |
| Marketplace verification | Run `node backend/scripts/verifyMarketplaceFlow.js` and `node backend/scripts/verifyMarketplaceGuards.js` after backend restart. |
| Data freshness | `GET /api/analytics/data-health` exposes freshness of trade/commodity/FX sync pipelines. |
| Compare page | Uses **`/api/analytics/compare`** — ensure backend deployed branch includes the `compare` route (see `analytics.js`). |
| Anomalies | Bell + Alerts depend on **`GET /api/orders/anomalies`** and seeded/trade data. |

---

## File index (key UI / APIs)

| What | Where |
|------|--------|
| Routes | `frontend/src/App.jsx` — includes `/forecasts`, `/advisory`, `/risk`, `/orders`, … |
| Compare UI | `frontend/src/pages/ComparativeAnalysis.jsx` |
| Forecasts F7 | `frontend/src/pages/Forecasts.jsx` |
| Advisory F14 | `frontend/src/pages/Advisory.jsx` |
| Alerts UI | `frontend/src/pages/Alerts.jsx` |
| Nav + bell | `frontend/src/components/Navbar.jsx` |
| Analytics + F7 proxies | `backend/routes/analytics.js` |
| Advisory F14 | `backend/routes/advisory.js`, `backend/services/advisoryRules.js` |
| Risk UI | `RiskScorePanel.jsx`, `RiskBreakdownPanel.jsx` |
| ML | `ml-service/main.py` |

---

*Historical note: prefer updating `README.md` and `REQUIREMENTS_COVERAGE.md` for current documentation.*
