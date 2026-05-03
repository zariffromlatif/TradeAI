# TradeAI Technical Explanation

This document summarizes how the current TradeAI implementation works across frontend, backend, and ML services.

## Architecture Overview

- `frontend/`: React SPA for analytics, risk, forecasting, marketplace, and admin pages
- `backend/`: Express API for auth, CRUD, analytics, reports, payment requests, and business rules
- `ml-service/`: FastAPI endpoints for risk and forecasting computations

Request flow:
1. Frontend calls backend REST endpoints
2. Backend accesses MongoDB and optionally calls ML endpoints
3. Backend returns normalized payloads with source/metadata hints used in UI

## Core Feature Mapping

### Analytics and Compare
- Backend: `backend/routes/analytics.js`
- Frontend: `frontend/src/pages/Dashboard.jsx`, `CommodityTrends.jsx`, `ComparativeAnalysis.jsx`
- Notes: compare includes sparse-data fallback to all-commodities HS total

### Risk and Forecast
- Backend: `backend/routes/analytics.js`, `backend/routes/advisory.js`
- ML: `ml-service/main.py`
- Frontend: `frontend/src/pages/Forecasts.jsx`, `frontend/src/components/RiskScorePanel.jsx`, `RiskBreakdownPanel.jsx`
- Notes: `ML_BASE_URL` is configurable via env

### Marketplace, Orders, and Anomaly Detection
- Backend: `backend/routes/marketplace.js`, `backend/routes/orders.js`, `backend/services/orderAnomaly.js`
- Frontend: `frontend/src/pages/Orders.jsx`, `frontend/src/pages/Alerts.jsx`

### Payments and Tiering
- Backend: `backend/routes/payment.js`, `backend/routes/paymentRequests.js`
- Frontend: `frontend/src/pages/Premium.jsx`, admin payment-request views
- Notes:
  - Tiers are `silver`, `gold`, `diamond`
  - Demo upgrade now creates a pending admin payment request

### Reports
- Backend: `backend/routes/reports.js`
- Frontend: admin reports page
- Notes: queue-first with inline fallback when queue/Redis is unavailable

### Admin Dataset Management
- Frontend: `frontend/src/pages/admin/AdminDatasets.jsx`
- Backend: `backend/routes/countries.js`, `commodities.js`, `trade.js`
- Notes:
  - Countries include `destructionDate`
  - UI shows destruction-date summary and remaining time
  - Save errors surface validation details from API responses

## Data Sync Strategy

- World Bank national totals: `backend/scripts/syncTradeFlows.js`
- Optional UN Comtrade HS enrichment: same script via env flags
- FX sync: `backend/scripts/syncFxRates.js`
- DNS resilience for Windows/ISP issues is included in sync/server logic

## Important Models and Middleware

- Auth checks: `backend/middleware/auth.js`
- Key models:
  - `backend/models/User.js`
  - `backend/models/Country.js`
  - `backend/models/Commodity.js`
  - `backend/models/TradeRecord.js`
  - `backend/models/Order.js`
  - `backend/models/MarketplaceRfq.js`
  - `backend/models/MarketplaceQuote.js`

## Operational Notes

- Run all three services for full feature coverage
- Refresh token claims after tier changes when needed
- For full setup instructions, use `WINDOWS_LOCAL_TESTING_GUIDE.md`
