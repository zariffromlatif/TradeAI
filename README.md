# TradeAI — Intelligent Global Trade & Risk Analytics Platform

A fullstack AI-powered trade analytics platform built with React, Node.js, FastAPI, and MongoDB.

**Repository:** [github.com/zariffromlatif/TradeAI](https://github.com/zariffromlatif/TradeAI)

### Functional requirements vs implementation

A **checklist table** for all **16** spec items (Modules 1–4), with **Met / Partial** status, file references, and a **pending gaps** backlog: see [**REQUIREMENTS_COVERAGE.md**](./REQUIREMENTS_COVERAGE.md).

---

## Sprint 1 — Completed Features

| Member       | Role              | Feature                                     | Status  |
| ------------ | ----------------- | ------------------------------------------- | ------- |
| **Member A** | Data Architect    | Feature 6: Core Dataset Management (CRUD)   | ✅ Done |
| **Member A** | Data Architect    | Feature 1: Trade Analytics Dashboard API    | ✅ Done |
| **Member B** | Visualizer        | Feature 1: Dashboard UI (React + Recharts)  | ✅ Done |
| **Member B** | Visualizer        | Feature 2: Commodity Price Trend Charts     | ✅ Done |
| **Member C** | Intelligence Lead | Feature 8: Automated Risk Scoring (FastAPI) | ✅ Done |
| **Member C** | Intelligence Lead | Feature 9: Risk Interpretability Panel      | ✅ Done |
| **Member C** | Intelligence Lead | Feature 7: Dual-factor forecasts (volume + real FX volatility) | ✅ Done |
| **Member D** | Operations Lead   | Feature 10: Simulated Order Management      | ✅ Done |
| **Member D** | Operations Lead   | RFQ Marketplace V1 (RFQ/quotes/deals)       | ✅ Done |
| **Member D** | Operations Lead   | Feature 5: Payment API (Stripe)             | ✅ Done |
| **Support**  | Reporting         | Feature 15: PDF trade summary               | ✅ Done |
| **Member C** | Intelligence Lead | Feature 14: Rule-based advisory (Express)   | ✅ Done |

---

## Sprint 2 — Member A (Data Architect)

| Feature | Description | Status |
| ------- | ----------- | ------ |
| **Feature 3** | Trade balance time series (`GET /api/analytics/trade-balance`) | ✅ Done |
| **Feature 1 (extended)** | Per-country import/export aggregates (`GET /api/analytics/country/:code`) | ✅ Done |
| **Feature 12** | Order anomaly checks + historical baselines (`services/orderAnomaly.js`, `GET /api/orders/anomalies`) | ✅ Done |
| **Security** | JWT auth; **POST/PUT/DELETE** on countries, commodities, and trade records require **admin** Bearer token | ✅ Done |

---

## Payments (Feature 5)

- **Implementation:** This project uses **Stripe** (test mode), not SSLCommerz. If your course spec mentioned SSLCommerz, treat **Stripe** as the chosen gateway for this repository.
- **Environment:** `STRIPE_SECRET_KEY` is required for **`POST /api/payment/create-session`** (Checkout). `STRIPE_WEBHOOK_SECRET` is required for **`POST /api/payment/webhook`** so `User.tier` can update to `premium` after `checkout.session.completed`.
- **Demo without Stripe:** Set **`DEMO_PAYMENT=true`** in `backend/.env` (see `.env.example`) to allow **`POST /api/payment/demo-upgrade`** with a MongoDB `userId` — useful for local demos only; **disable in production**.
- **Frontend:** Premium flow and return URLs — `/premium`, `/payment/success`, `/payment/cancel` (must match `success_url` / `cancel_url` in `backend/routes/payment.js` for your deployed origin).
- **Test card:** `4242 4242 4242 4242` (any future expiry, any CVC) in Stripe test mode.
- **Local webhooks:** Install [Stripe CLI](https://stripe.com/docs/stripe-cli), run `stripe listen --forward-to localhost:5000/api/payment/webhook`, copy the `whsec_...` secret into `STRIPE_WEBHOOK_SECRET`, restart the backend. If signature verification fails, ensure the webhook route receives the **raw** body (ordering of `express.json()` vs. the Stripe route may need adjustment).

---

## PDF reporting (Feature 15)

- **Endpoint:** `GET /api/reports/trade-summary` returns a PDF attachment with the same top exporter/importer figures as `GET /api/analytics/dashboard`.
- **UI:** The dashboard has **Download PDF report** (calls the endpoint via blob download).
- **Disclaimer:** The PDF is an illustrative snapshot, not financial or legal advice.

---

## Forecasts (Feature 7)

- **Dual factor:** (1) **Trade volume** — monthly totals from `TradeRecord.volume` (optional filters: commodity, country, import/export), forecast via lag-1 linear regression in the ML service (naive fallback if the series is short). (2) **FX volatility** — log-return volatility from real historical exchange-rate series stored in `FxRate.history`.
- **Express:** `POST /api/analytics/forecast/volume` (body: `commodity`, optional `country`, `type`, `horizon`) and `POST /api/analytics/forecast/price-volatility` (body: `fxPair`, optional fallback inputs). Both proxy to the ML service on port **8000**.
- **ML:** `POST /api/forecast/trade-volume`, `POST /api/forecast/price-volatility` in `ml-service/main.py`.
- **UI:** `frontend/src/pages/Forecasts.jsx`, route **`/forecasts`**.
- **FX sync script:** `backend/scripts/syncFxRates.js` (run before first FX forecast to populate pairs).

---

## RFQ Marketplace (Feature 10 extension)

- **Flow:** buyer creates RFQ -> sellers submit quotes -> RFQ owner buyer accepts one quote -> platform creates deal order.
- **Settlement:** tracked off-platform via settlement states (`unpaid`, `partially_settled`, `settled`, `disputed`).
- **Security model:** marketplace writes require JWT; identity is derived from `req.auth.sub` (no `x-user-id` fallback).
- **Authorization:** buyer/seller role checks and ownership checks are enforced (RFQ owner/admin for state + accept, deal parties/admin for settlement).
- **Backend:** `backend/routes/marketplace.js` with `MarketplaceRfq`, `MarketplaceQuote`, and extended `Order` model.
- **Frontend:** `frontend/src/pages/Orders.jsx` now includes RFQ Board, quote actions, and My Deals tab.

---

## Advisory (Feature 14)

- **Express-only** rule engine: `POST /api/advisory/recommend` with body `{ countryCode, commodity? }`.
- **Inputs:** ML **risk score** (same payload as `GET /api/analytics/risk/:country` — requires **ml-service** on **8000** when available), country **inflation** and **trade balance** from Mongo, optional **commodity** `priceHistory` log-return volatility computed in Node.
- **Output:** `signals`, ranked `recommendations` (`severity`, `title`, `detail`), educational **disclaimer**.
- **Code:** `backend/services/advisoryRules.js`, `backend/routes/advisory.js`; UI **`/advisory`** → `Advisory.jsx`.

---

## Project Structure

```
TradeAI/
├── backend/                        ← Node.js + Express API (port 5000)
│   ├── .env                        ← DO NOT COMMIT (see .env.example)
│   ├── .env.example
│   ├── server.js                   ← Express app entry point
│   ├── seed.js                     ← Run once to populate database
│   ├── middleware/
│   │   └── auth.js                 ← JWT requireAuth / requireAdmin
│   ├── services/
│   │   ├── orderAnomaly.js         ← Feature 12: anomaly rules + trade history
│   │   ├── dashboardStats.js       ← Shared dashboard aggregates (JSON + PDF)
│   │   ├── forecastData.js         ← F7 monthly volume series for analytics
│   │   └── advisoryRules.js        ← F14 recommendation rules + price vol helper
│   ├── models/
│   │   ├── Country.js              ← GDP, inflation, trade balance
│   │   ├── Commodity.js            ← price history array
│   │   ├── TradeRecord.js          ← bilateral trade (reporter + partner)
│   │   ├── Order.js                ← simulated trade orders (Member D)
│   │   └── User.js                 ← tier + role (admin/user)
│   └── routes/
│       ├── auth.js                 ← register, login, me
│       ├── countries.js            ← CRUD /api/countries
│       ├── commodities.js          ← CRUD /api/commodities
│       ├── trade.js                ← CRUD /api/trade
│       ├── analytics.js            ← Dashboard, trade-balance, country, ML bridge
│       ├── orders.js               ← CRUD /api/orders (Member D)
│       ├── payment.js              ← Stripe + demo payment /api/payment (Member D)
│       ├── simulation.js           ← F11/F13 /api/sim
│       ├── reports.js              ← F15 PDF /api/reports
│       └── advisory.js             ← F14 /api/advisory
│
├── frontend/                       ← React + Tailwind + Recharts (port 5173)
│   └── src/
│       ├── App.jsx                 ← Router + layout
│       ├── pages/
│       │   ├── Dashboard.jsx       ← Feature 1: KPI + charts + PDF download (F15)
│       │   ├── CommodityTrends.jsx ← Feature 2: commodity trends
│       │   ├── ComparativeAnalysis.jsx, Alerts.jsx, Orders.jsx
│       │   ├── Premium.jsx, PaymentSuccess.jsx, PaymentCancel.jsx
│       │   ├── Simulation.jsx      ← F11 / F13 calculators (/sim)
│       │   ├── Forecasts.jsx       ← F7 volume + real FX volatility (/forecasts)
│       │   └── Advisory.jsx        ← F14 advisory (/advisory)
│       └── components/
│           ├── Navbar.jsx          ← Top navigation
│           ├── StatCard.jsx        ← KPI card component
│           ├── RiskScorePanel.jsx  ← Feature 8: risk score UI (Member C)
│           └── RiskBreakdownPanel.jsx ← Feature 9: risk breakdown UI (Member C)
│
└── ml-service/                     ← Python FastAPI ML service (port 8000)
    ├── main.py                     ← Risk scoring engine (Member C)
    └── requirements.txt
```

---

## Setup — Run the Full Stack

### Prerequisites

- Node.js v18+
- Python 3.12
- MongoDB Atlas account (`MONGO_URI`)
- Stripe account (optional for demo-only: use `DEMO_PAYMENT=true` instead) — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` for real Checkout + webhooks

---

### 1. Clone the repo

```bash
git clone https://github.com/zariffromlatif/TradeAI.git
cd TradeAI
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env` from `.env.example` and fill in real values:

- `MONGO_URI` — Atlas connection string (include database name, e.g. `/tradeai`)
- `JWT_SECRET` — long random string (required for register/login)
- `JWT_ACCESS_EXPIRES_IN` — access token lifetime (default `1d`)
- `JWT_REMEMBER_EXPIRES_IN` — remember-me token lifetime (default `14d`)
- `CORS_ORIGINS` — comma-separated allowed frontend origins (set explicitly for production)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — for Stripe Checkout + webhook tier upgrades (optional if using demo payment only)
- `DEMO_PAYMENT` — set `true` only for local demo of `POST /api/payment/demo-upgrade` (see **Payments** above)

```bash
node server.js
# → Server on port 5000
```

Use `Authorization: Bearer <token>` on protected routes. Registration supports `buyer` / `seller`; admin role requires valid `adminCode`.

### 3. ML Service setup

```bash
cd ml-service
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
# → Uvicorn running on http://127.0.0.1:8000
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Create `frontend/.env` from `frontend/.env.example`:

- `VITE_API_BASE_URL=http://localhost:5000/api`

### 5. (Optional) Re-seed the database

```bash
cd backend
node seed.js
```

---

## Running All 3 Services Together

Open **3 terminals simultaneously**:

| Terminal | Directory     | Command                               | URL                   |
| -------- | ------------- | ------------------------------------- | --------------------- |
| 1        | `backend/`    | `node server.js`                      | http://localhost:5000 |
| 2        | `ml-service/` | `python -m uvicorn main:app --reload` | http://127.0.0.1:8000 |
| 3        | `frontend/`   | `npm run dev`                         | http://localhost:5173 |

---

## CI deploy gate

- Workflow: `.github/workflows/ci.yml`
- Frontend gate: `npm run lint` + `npm run build`
- Backend gate: starts MongoDB + backend, seeds data, runs:
  - `node backend/scripts/verifyMarketplaceFlow.js`
  - `node backend/scripts/verifyMarketplaceGuards.js`

---

## Trade records (normalized model)

`TradeRecord` rows are normalized bilateral/national flows:

| Field | Meaning |
| --- | --- |
| `reporter` | Country declaring the flow |
| `partner` | Counterparty country |
| `type` | `export` = reporter exports **to** partner; `import` = reporter imports **from** partner |

Dashboard top exporters/importers and country analytics aggregate by **`reporter`**. **Compare** charts national totals per selected country (sum over all partners for that reporter).

**Upgrading from older data:** remove legacy trade documents, then run `node backend/scripts/syncTradeFlows.js` and/or `node backend/seed.js`.

**Deployment / real charts:** configure `TRADE_SYNC_COUNTRY_CODES` and run `node backend/scripts/syncTradeFlows.js`. The script ingests free World Bank annual imports/exports (USD) as reporter-vs-world records so Compare and Forecast have stable non-zero series.

---

## API Reference

### Backend (port 5000)

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| POST | `/api/auth/register` | Register (`buyer`/`seller`; `admin` via invite code) |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Current user (Bearer required) |
| GET | `/api/countries` | All countries |
| GET | `/api/countries/:id` | Single country |
| POST/PUT/DELETE | `/api/countries`, `/api/countries/:id` | **Admin + Bearer** required |
| GET | `/api/commodities` | All commodities |
| GET | `/api/commodities/:id` | Single commodity + price history |
| POST/PUT/DELETE | `/api/commodities`, `/api/commodities/:id` | **Admin + Bearer** required |
| GET | `/api/trade` | All trade records (populated) |
| GET | `/api/trade/:id` | Single trade record |
| POST/PUT/DELETE | `/api/trade`, `/api/trade/:id` | **Admin + Bearer** required |
| GET | `/api/analytics/dashboard` | Top 5 exporters + importers |
| GET | `/api/analytics/data-health` | Data freshness status for trade, commodity, and FX |
| GET | `/api/analytics/trade-balance` | Monthly balance; query `country`, `region` |
| GET | `/api/analytics/country/:code` | Per-country import/export; `?monthly=true` for series |
| GET | `/api/analytics/risk/:country` | Risk score via ML bridge |
| POST | `/api/analytics/risk-score` | Full risk score (body → ML) |
| POST | `/api/analytics/risk/:country/breakdown` | Risk interpretability breakdown |
| GET | `/api/analytics/compare` | Dual-country time series (query: countryA, countryB, type, commodity) |
| POST | `/api/analytics/risk-score/batch` | Batch risk scores (proxy to ML) |
| POST | `/api/analytics/forecast/volume` | F7 trade-volume forecast (`commodity`, optional `country`, `type`, `horizon`) — **requires ML** |
| POST | `/api/analytics/forecast/price-volatility` | F7 log-return volatility from real FX history (`fxPair`) — **requires ML** |
| GET | `/api/analytics/fx/pairs` | List available synced FX pairs for F7 |
| GET | `/api/orders` | All orders |
| GET | `/api/orders/anomalies` | Orders flagged by anomaly logic |
| GET/POST/PUT/DELETE | `/api/orders`, `/api/orders/:id` | Order management |
| GET/POST | `/api/marketplace/rfqs` | Marketplace RFQ list/create |
| GET/PATCH | `/api/marketplace/rfqs/:id`, `/api/marketplace/rfqs/:id/state` | RFQ detail/state transition |
| GET/POST | `/api/marketplace/rfqs/:id/quotes` | Quote list/create for RFQ |
| POST | `/api/marketplace/quotes/:id/accept` | Accept quote + create deal |
| GET | `/api/marketplace/deals` | RFQ-derived deals |
| PUT | `/api/marketplace/deals/:id/settlement` | Update settlement tracking |
| POST | `/api/payment/create-session` | Stripe checkout session |
| POST | `/api/payment/webhook` | Stripe webhook (raw body); upgrades tier on completed checkout |
| POST | `/api/payment/demo-upgrade` | Demo premium upgrade if `DEMO_PAYMENT=true` |
| GET | `/api/payment/status/:userId` | User tier (free/premium) |
| POST | `/api/sim/profitability` | F11 margin simulation |
| POST | `/api/sim/landed-cost` | F13 landed cost simulation |
| GET | `/api/reports/trade-summary` | F15 PDF — top exporters/importers (same data as dashboard) |
| POST | `/api/advisory/recommend` | F14 advisory — body: `countryCode`, optional `commodity` id; uses ML risk when available |

### ML Service (port 8000)

| Method | Endpoint                     | Description                             |
| ------ | ---------------------------- | --------------------------------------- |
| GET    | `/`                          | Health check                            |
| POST   | `/api/risk-score`            | Score a country (10 indicators → 1-100) |
| POST   | `/api/risk-score/batch`      | Score up to 20 countries at once        |
| POST   | `/api/risk/{code}/breakdown` | Full per-indicator breakdown (FR9)      |
| POST   | `/api/forecast/trade-volume` | F7 volume forecast from value series (used by Express proxy) |
| POST   | `/api/forecast/price-volatility` | F7 volatility from FX/price historical returns |
| GET    | `/docs`                      | Auto-generated API docs (Swagger UI)    |

---

## What Each Member Should Know

### Member A (Backend / data)

- Secured CRUD: use **admin** JWT on writes to countries, commodities, trade.
- Country analytics: `/api/analytics/country/:code` and `/api/analytics/trade-balance`.
- Anomaly logic lives in `backend/services/orderAnomaly.js`.

### Member B (Frontend)

- Pages are in `frontend/src/pages/`
- Components are in `frontend/src/components/`
- All API calls use `http://localhost:5000/api` as base
- Routes include `/risk`, `/risk/breakdown`, `/compare`, `/forecasts`, `/advisory`, `/alerts`, `/orders`, `/sim`, `/premium`, payment return URLs

### Member C (ML Service)

- All work is in `ml-service/main.py` — risk (F8/F9) and **forecasts (F7)**; **F14** advisory rules run in **Express** but consume ML risk scores
- The backend bridges ML calls through `/api/analytics/` (and related routes) so the frontend can stay on port **5000**; **F7 forecast routes still require the ML process on port 8000**
- API docs available at `http://127.0.0.1:8000/docs` when service is running

### Member D (Orders & Payment)

- Order routes: `backend/routes/orders.js`; UI: `frontend/src/pages/Orders.jsx`
- Payment routes: `backend/routes/payment.js` (Stripe + optional demo upgrade)
- Models: `backend/models/Order.js`, `backend/models/User.js`
- Stripe test card: `4242 4242 4242 4242` — see **Payments** for SSLCommerz vs Stripe and `DEMO_PAYMENT`
- PDF report: `backend/routes/reports.js`, dashboard download button

---

## Database

- **Provider:** MongoDB Atlas (cloud)
- **Database:** `tradeai` (or as configured in `MONGO_URI`)
- **Collections:** `countries`, `commodities`, `traderecords`, `orders`, `users`
- **Seed data:** 5 countries, 5 commodities, 150 trade records
