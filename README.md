# TradeAI - Global Trade Analytics Platform

TradeAI is a full-stack trade intelligence platform for analytics, risk scoring, forecasting, simulation, marketplace workflows, and intelligence reporting.

It combines:

- **Frontend**: React + Vite
- **Backend API**: Node.js + Express + MongoDB
- **ML service**: FastAPI + scikit-learn

---

## Current Status (April 2026)

This repository includes:

- Silver / Gold / Diamond tier system with route-level enforcement
- Plans page (`/plans`) with Stripe + demo upgrade flow
- Comparative Intelligence fallback behavior for sparse commodity coverage
- Real-data sync strategy:
  - World Bank national totals (stable baseline)
  - Optional UN Comtrade HS commodity ingestion (config-driven)
- Forecast pipeline centered on Feature-AR style volume forecasting + volatility tools
- Report job system with queue-first execution and inline fallback when queue infra is unavailable

---

## Core Capabilities

### Analytics

- Dashboard KPIs and trade trends
- Comparative Intelligence (`/compare`) for country vs country
- Commodity trends
- Trade balance analytics

### Risk and Forecasting

- Single-country risk score and breakdown
- Batch risk scoring (tier-gated)
- Trade volume forecasting with tier-capped forecast horizon
- Price/volatility forecast utilities
- Advisory recommendations

### Operations

- RFQ-style marketplace and order workflows
- Order anomaly visibility
- Simulation endpoints for landed-cost/profitability scenarios

### Reporting

- PDF trade summary endpoint
- Admin reports page with generation/history/download
- Retry/cancel controls

---

## Access Tiers

Users are assigned one of:

- `silver` (default)
- `gold`
- `diamond`

Tier checks are enforced in backend middleware (`requireMinTier`) with DB fallback to avoid stale JWT claim issues after upgrades.

After upgrade, refresh token claims using:

- `POST /api/auth/refresh-token-claims`

---

## Data Source Strategy

### World Bank (default baseline)

`backend/scripts/syncTradeFlows.js` ingests annual national totals (reporter vs world aggregate) from:

- `NE.EXP.GNFS.CD`
- `NE.IMP.GNFS.CD`

This guarantees stable baseline coverage but is not full bilateral commodity granularity.

### Optional UN Comtrade HS ingestion

The same script can optionally ingest HS commodity totals when enabled via env flags:

- `TRADE_SYNC_COMTRADE_ENABLE=true`
- `TRADE_SYNC_COMTRADE_HS_CODES=...`
- `COMTRADE_API_KEY=...` (if required by your plan)

This improves country+commodity coverage for Comparative Intelligence.

### Compare behavior with sparse commodity data

On the frontend compare page:

- selected commodity is requested first
- if no overlap is found, it auto-falls back to **All Commodities (HS TOTAL)**
- user sees a fallback notice

---

## Architecture

### Services

- `frontend/` - React SPA
- `backend/` - Express REST API + MongoDB models/routes/scripts
- `ml-service/` - FastAPI ML endpoints

### Runtime flow

1. Frontend calls backend APIs
2. Backend performs DB logic and, when needed, calls ML service
3. Backend returns normalized payloads to UI

---

## Local Setup

For full Windows instructions, see:

- `WINDOWS_LOCAL_TESTING_GUIDE.md`

Quick start:

1. Install dependencies in `backend/`, `frontend/`, and `ml-service/`
2. Copy `backend/.env.example` to `backend/.env` and fill required values
3. Start services:
   - backend: `node server.js`
   - frontend: `npm run dev`
   - ml-service: `uvicorn main:app --reload`
4. Seed/sync data as needed

---

## Backend Environment Variables

Minimum commonly required values:

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_INVITE_CODE`
- `CORS_ORIGINS`

Payments:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DEMO_PAYMENT` (for local demo path only)
- `FRONTEND_PUBLIC_URL`
- `STRIPE_GOLD_AMOUNT_CENTS`
- `STRIPE_DIAMOND_AMOUNT_CENTS`

Trade sync:

- `TRADE_SYNC_COUNTRY_CODES`
- `TRADE_SYNC_YEAR_SPAN`
- `TRADE_SYNC_HTTP_TIMEOUT_MS`
- `TRADE_SYNC_HTTP_ATTEMPTS`
- `TRADE_SYNC_COMTRADE_ENABLE`
- `TRADE_SYNC_COMTRADE_HS_CODES`
- `COMTRADE_API_KEY`

Reports/queue:

- `REDIS_URL` (recommended for queue mode)
- `REPORT_RETENTION_DAYS`
- `REPORT_CLEANUP_INTERVAL_MINUTES`

---

## Common Data Scripts

- `node backend/seed.js`
- `node backend/scripts/syncTradeFlows.js`
- `node backend/scripts/syncFxRates.js`

---

## Reporting Behavior

Reports use a queue-first model. If queue/Redis is unavailable, the backend falls back to inline generation to keep report creation functional.

---

## Troubleshooting

### Compare page has no selected-commodity overlap

- Expected for sparse commodity-country pairs with current coverage
- App auto-falls back to HS total when available
- Improve coverage by enabling Comtrade HS sync and syncing more countries/years

### Forecast/report endpoints deny access after upgrade

- Refresh token claims:
  - `POST /api/auth/refresh-token-claims`

### Report generation issues

- Verify backend logs and queue availability
- Inline fallback should still generate reports if queue is unavailable

---

## Security Notes

- Never commit secrets (`.env`, private keys)
- Keep `DEMO_PAYMENT=false` in production
- Use strong JWT secret and restricted CORS in production