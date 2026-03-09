# TradeAI — Intelligent Global Trade & Risk Analytics Platform

A fullstack AI-powered trade analytics platform built with React, Node.js, FastAPI, and MongoDB.

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
| **Member D** | Operations Lead   | Feature 10: Simulated Order Management      | ✅ Done |
| **Member D** | Operations Lead   | Feature 5: Payment API (Stripe)             | ✅ Done |

---

## Project Structure

```
TradeAI/
├── backend/                        ← Node.js + Express API (port 5000)
│   ├── .env                        ← DO NOT COMMIT (ask Member A for credentials)
│   ├── server.js                   ← Express app entry point
│   ├── seed.js                     ← Run once to populate database
│   ├── models/
│   │   ├── Country.js              ← GDP, inflation, trade balance
│   │   ├── Commodity.js            ← price history array
│   │   ├── TradeRecord.js          ← import/export records
│   │   ├── Order.js                ← simulated trade orders (Member D)
│   │   └── User.js                 ← user tiers: free/premium (Member D)
│   └── routes/
│       ├── countries.js            ← CRUD /api/countries
│       ├── commodities.js          ← CRUD /api/commodities
│       ├── trade.js                ← CRUD /api/trade
│       ├── analytics.js            ← Dashboard + ML bridge /api/analytics
│       ├── orders.js               ← CRUD /api/orders (Member D)
│       └── payment.js              ← Stripe checkout /api/payment (Member D)
│
├── frontend/                       ← React + Tailwind + Recharts (port 5173)
│   └── src/
│       ├── App.jsx                 ← Router + layout
│       ├── pages/
│       │   ├── Dashboard.jsx       ← Feature 1: KPI cards + bar charts (Member B)
│       │   └── CommodityTrends.jsx ← Feature 2: commodity selector + line chart (Member B)
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
- Python 3.10+
- MongoDB Atlas account (get `MONGO_URI` from Member A)
- Stripe account (get `STRIPE_SECRET_KEY` from Member A/D)

---

### 1. Clone the repo

```bash
git clone https://github.com/YOURUSERNAME/TradeAI.git
cd TradeAI
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.tsjkfiq.mongodb.net/tradeai?appName=Cluster0
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_placeholder
```

> Ask **Member A** privately for the actual credentials.

```bash
node server.js
# → Server on port 5000
```

### 3. ML Service setup

```bash
cd ml-service
pip install fastapi uvicorn scikit-learn numpy
python -m uvicorn main:app --reload
# → Uvicorn running on http://127.0.0.1:8000
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

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

## API Reference

### Backend (port 5000)

| Method              | Endpoint                                 | Description                         |
| ------------------- | ---------------------------------------- | ----------------------------------- |
| GET                 | `/api/countries`                         | All countries                       |
| GET/POST/PUT/DELETE | `/api/countries/:id`                     | Country CRUD                        |
| GET                 | `/api/commodities`                       | All commodities                     |
| GET                 | `/api/commodities/:id`                   | Single commodity + price history    |
| GET                 | `/api/trade`                             | All trade records                   |
| GET                 | `/api/analytics/dashboard`               | Top 5 exporters + importers         |
| GET                 | `/api/analytics/risk/:country`           | Risk score via ML bridge            |
| POST                | `/api/analytics/risk-score`              | Full risk score with all indicators |
| POST                | `/api/analytics/risk/:country/breakdown` | Risk interpretability breakdown     |
| GET/POST/PUT/DELETE | `/api/orders`                            | Order management                    |
| POST                | `/api/payment/create-session`            | Stripe checkout session             |
| GET                 | `/api/payment/status/:userId`            | User tier (free/premium)            |

### ML Service (port 8000)

| Method | Endpoint                     | Description                             |
| ------ | ---------------------------- | --------------------------------------- |
| GET    | `/`                          | Health check                            |
| POST   | `/api/risk-score`            | Score a country (10 indicators → 1-100) |
| POST   | `/api/risk-score/batch`      | Score up to 20 countries at once        |
| POST   | `/api/risk/{code}/breakdown` | Full per-indicator breakdown (FR9)      |
| GET    | `/docs`                      | Auto-generated API docs (Swagger UI)    |

---

## What Each Member Should Know

### Member B (Frontend)

- Pages are in `frontend/src/pages/`
- Components are in `frontend/src/components/`
- All API calls use `http://localhost:5000/api` as base
- Member C's `RiskScorePanel.jsx` and `RiskBreakdownPanel.jsx` are ready to import into any page

### Member C (ML Service)

- All work is in `ml-service/main.py`
- The backend bridges all ML calls through `/api/analytics/` so frontend never calls port 8000 directly
- API docs available at `http://127.0.0.1:8000/docs` when service is running

### Member D (Orders & Payment)

- Order routes: `backend/routes/orders.js`
- Payment routes: `backend/routes/payment.js`
- Models: `backend/models/Order.js`, `backend/models/User.js`
- Stripe is in test mode — use card `4242 4242 4242 4242` for test payments

---

## Database

- **Provider:** MongoDB Atlas (cloud)
- **Database:** `tradeai`
- **Collections:** `countries`, `commodities`, `traderecords`, `orders`, `users`
- **Seed data:** 5 countries, 5 commodities, 150 trade records
