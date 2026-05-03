# TradeAI Functional Requirements Coverage

Status keys:
- **Implemented**: available in current codebase and UI/API flow
- **Partially implemented**: exists, but narrower than ideal scope
- **Planned enhancement**: identified extension for future iteration

## Module 1 - Trade Intelligence & Data Management

| ID | Requirement | Status | Implementation |
|---|---|---|---|
| F1 | Integrated trade analytics dashboard | Implemented | `frontend/src/pages/Dashboard.jsx`, `GET /api/analytics/dashboard` |
| F2 | Commodity trend visualization | Implemented | `frontend/src/pages/CommodityTrends.jsx`, `GET /api/commodities/:id` |
| F3 | Trade balance analytics (time-series) | Implemented | `GET /api/analytics/trade-balance`, dashboard/analytics flows |
| F4 | Comparative intelligence by country + commodity | Implemented | `frontend/src/pages/ComparativeAnalysis.jsx`, fallback to `HS TOTAL` when sparse |
| F5 | Payment API integration (manual + Stripe path) | Implemented | `backend/routes/payment.js`, `backend/routes/paymentRequests.js`, `frontend/src/pages/Premium.jsx` |
| F6 | Admin dataset CRUD | Implemented | `backend/routes/countries.js`, `commodities.js`, `trade.js`, `frontend/src/pages/admin/AdminDatasets.jsx` |

## Module 2 - Prediction & Risk Analytics

| ID | Requirement | Status | Implementation |
|---|---|---|---|
| F7 | Predictive engine (volume + volatility endpoints) | Implemented | `POST /api/analytics/forecast/volume`, `POST /api/analytics/forecast/price-volatility`, ML service forecast routes |
| F8 | Automated risk scoring | Implemented | `GET /api/analytics/risk/:country`, `POST /api/analytics/risk-score` |
| F9 | Risk interpretability panel | Implemented | `frontend/src/components/RiskBreakdownPanel.jsx`, `POST /api/analytics/risk/:country/breakdown` |

## Module 3 - Trade Operation & Decision Layer

| ID | Requirement | Status | Implementation |
|---|---|---|---|
| F10 | Simulated order lifecycle | Implemented | `backend/routes/orders.js`, `frontend/src/pages/Orders.jsx` |
| F11 | Dynamic profitability simulator | Implemented | `backend/routes/simulation.js`, `frontend/src/pages/Simulation.jsx` |
| F12 | Anomaly and fraud detection | Implemented | `backend/services/orderAnomaly.js`, alerts/admin anomaly views |
| F18 | RFQ marketplace | Implemented | `backend/routes/marketplace.js`, `MarketplaceRfq`, `MarketplaceQuote`, `Orders.jsx` RFQ board |
| F19 | Stress test calculator | Implemented | Stress scenarios in `Simulation.jsx` with profitability impact outputs |

## Module 4 - Settlement, Reporting & Advisory

| ID | Requirement | Status | Implementation |
|---|---|---|---|
| F13 | Landed cost and settlement simulation | Implemented | `POST /api/sim/landed-cost`, settlement workflow endpoints |
| F14 | AI/rule-based advisory engine | Implemented | `POST /api/advisory/recommend`, `frontend/src/pages/Advisory.jsx` |
| F15 | Reporting and PDF generation | Implemented | `backend/routes/reports.js`, queue-first with inline fallback |
| F16 | Risk notification system | Partially implemented | bell/alert surfaces for anomalies and admin thresholds; broader push model is enhancement-ready |

## Admin Panel Coverage

- Dashboard overview: implemented
- Dataset CRUD: implemented (includes country `destructionDate` and remaining time display)
- User management: implemented
- Payment request approval/rejection: implemented
- Orders and anomalies moderation: implemented
- Risk and alert threshold controls: implemented
- Reports generation/history/download/retry/cancel: implemented

## Notes

- Tiers are `silver`, `gold`, `diamond`.
- Demo upgrade now creates pending requests for admin approval before tier changes.
- Reports continue functioning when Redis queue is unavailable (inline fallback path).
