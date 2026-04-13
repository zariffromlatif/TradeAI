# TradeAI — Feature checklist (16-feature master list)

_Last reviewed: F14 Express advisory (`/advisory`, `POST /api/advisory/recommend`)._

## Member A — Data Architect
- [x] **F6** — Core dataset management (secure CRUD)
- [x] **F1** — Integrated trade analytics (dashboard + per-country API)
- [x] **F3** — Trade balance analytics
- [x] **F12** — Anomaly detection (orders + historical baselines)

## Member B — Visualizer
- [x] **F1** — Dashboard UI / charts (`Dashboard.jsx`)
- [x] **F2** — Commodity price trends (`CommodityTrends.jsx`)
- [x] **F4** — Comparative intelligence (`/compare`, `ComparativeAnalysis.jsx`, `GET /api/analytics/compare`)
- [x] **F16** — Risk / anomaly notifications (bell + `/alerts`, polls `GET /api/orders/anomalies`)

## Member C — Intelligence Lead
- [x] **F8** — Automated risk scoring (FastAPI + Express proxy)
- [x] **F9** — Risk interpretability in-app — `/risk`, `/risk/breakdown` in `App.jsx`
- [x] **F7** — Dual-factor predictive engine — monthly **trade volume** forecast + **`priceHistory`** log-return volatility **proxy** (not FX); `POST /api/analytics/forecast/*`, ML `/api/forecast/*`, UI `/forecasts`
- [x] **F14** — Advisory engine — rule-based recommendations from ML risk + macro + optional commodity price volatility; `advisoryRules.js`, `routes/advisory.js`, UI `/advisory`

## Member D — Operations Lead
- [x] **F10** — Simulated order management UI (`Orders.jsx`, `/orders`)
- [x] **F5** — Payment integration — Stripe + README; SSLCommerz out of scope; `DEMO_PAYMENT` documented
- [x] **F11** — Profitability simulator (`/sim`, `POST /api/sim/profitability`)
- [x] **F13** — Landed cost simulation (`POST /api/sim/landed-cost`)

## Support
- [x] **F15** — PDF reporting (`GET /api/reports/trade-summary`, dashboard download)

---

### Quick counts
| Status | Count |
|--------|-------|
| Done | 16 |
| Not started | 0 |
