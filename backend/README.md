# TradeAI Backend

Backend API for TradeAI (Express + MongoDB + Mongoose).

## What This Service Handles

- Authentication and authorization
- Tier-aware access control (`silver`, `gold`, `diamond`)
- Analytics and comparison APIs
- Risk/forecast proxy calls to ML service
- RFQ marketplace and order operations
- Payment request and Stripe upgrade flows
- Admin dataset CRUD and report workflows

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
node server.js
```

Expected: `Server on port 5000`

## Minimum `.env` Keys

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_INVITE_CODE`
- `CORS_ORIGINS`
- `ML_BASE_URL`

Optional/feature keys:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_PUBLIC_URL`
- `STRIPE_GOLD_AMOUNT_CENTS`
- `STRIPE_DIAMOND_AMOUNT_CENTS`
- `DEMO_PAYMENT`
- `REDIS_URL`

## Important API Areas

- Auth: `/api/auth/*`
- Analytics: `/api/analytics/*`
- Advisory: `/api/advisory/*`
- Simulation: `/api/sim/*`
- Marketplace: `/api/marketplace/*`
- Orders and anomalies: `/api/orders/*`
- Payment and requests: `/api/payment/*`, `/api/payment-requests/*`
- Reports: `/api/reports/*`
- Admin CRUD: `/api/countries`, `/api/commodities`, `/api/trade`

## Operational Scripts

- `node seed.js`
- `node scripts/syncTradeFlows.js`
- `node scripts/syncFxRates.js`
- `node scripts/verifyMarketplaceFlow.js`
- `node scripts/verifyMarketplaceGuards.js`

## Notes

- Reports use queue-first execution and fallback to inline generation if queue infra is unavailable.
- Demo upgrades should create pending payment requests for admin approval before tier changes.
