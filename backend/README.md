# TradeAI — Backend API

Built by **Member A (Data Architect)**. This is the foundation for the entire project.

---

## Prerequisites

Make sure you have these installed:

- [Node.js](https://nodejs.org/) v18+
- [Python](https://www.python.org/) 3.10+

---

## Setup Instructions

### 1. Clone the repo and navigate to backend

```bash
cd backend
npm install
```

### 2. Create your `.env` file

Create a file named `.env` inside the `backend/` folder:

```
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.tsjkfiq.mongodb.net/tradeai?appName=Cluster0
```

> Ask **Member A** for the actual MongoDB Atlas credentials. Do NOT commit `.env` to git.

### 3. Start the backend server

```bash
node server.js
```

Expected output:

```
Server on port 5000
```

---

## ML Service Setup (Member C's workspace)

```bash
cd ml-service
python -m uvicorn main:app --reload
```

Expected output:

```
Uvicorn running on http://127.0.0.1:8000
```

---

## Project Folder Structure

```
TradeAI/
├── backend/
│   ├── .env                  ← MongoDB connection string (DO NOT COMMIT)
│   ├── .gitignore
│   ├── server.js             ← Express app entry point (port 5000)
│   ├── seed.js               ← Run once to populate the database
│   ├── package.json
│   │
│   ├── models/               ← MongoDB schemas (Mongoose)
│   │   ├── Country.js        ← name, code, region, GDP, inflation, tradeBalance
│   │   ├── Commodity.js      ← name, category, unit, currentPrice, priceHistory[]
│   │   └── TradeRecord.js    ← country (ref), commodity (ref), type, volume, value, date
│   │
│   └── routes/               ← Express API route handlers
│       ├── countries.js      ← CRUD for countries
│       ├── commodities.js    ← CRUD for commodities
│       ├── trade.js          ← CRUD for trade records
│       ├── analytics.js      ← Dashboard aggregation + ML bridge
│       ├── orders.js         ← ⏳ Member D implements this (Feature 10)
│       └── payment.js        ← ⏳ Member D implements this (Feature 5)
│
├── frontend/                 ← ⏳ Member B's workspace
│   └── src/
│
└── ml-service/               ← ⏳ Member C's workspace
    ├── main.py               ← FastAPI app (port 8000)
    └── requirements.txt
```

---

## Available API Endpoints

Base URL: `http://localhost:5000`

### Countries

| Method | Endpoint             | Description        |
| ------ | -------------------- | ------------------ |
| GET    | `/api/countries`     | Get all countries  |
| GET    | `/api/countries/:id` | Get single country |
| POST   | `/api/countries`     | Create a country   |
| PUT    | `/api/countries/:id` | Update a country   |
| DELETE | `/api/countries/:id` | Delete a country   |

### Commodities

| Method | Endpoint               | Description                                      |
| ------ | ---------------------- | ------------------------------------------------ |
| GET    | `/api/commodities`     | Get all commodities                              |
| GET    | `/api/commodities/:id` | Get single commodity (includes `priceHistory[]`) |
| POST   | `/api/commodities`     | Create a commodity                               |
| PUT    | `/api/commodities/:id` | Update a commodity                               |
| DELETE | `/api/commodities/:id` | Delete a commodity                               |

### Trade Records

| Method | Endpoint         | Description                                                      |
| ------ | ---------------- | ---------------------------------------------------------------- |
| GET    | `/api/trade`     | Get all trade records (populated with country & commodity names) |
| GET    | `/api/trade/:id` | Get single trade record                                          |
| POST   | `/api/trade`     | Create a trade record                                            |
| PUT    | `/api/trade/:id` | Update a trade record                                            |
| DELETE | `/api/trade/:id` | Delete a trade record                                            |

### Analytics (Feature 1)

| Method | Endpoint                       | Description                                      |
| ------ | ------------------------------ | ------------------------------------------------ |
| GET    | `/api/analytics/dashboard`     | Top 5 exporters + top 5 importers by total value |
| GET    | `/api/analytics/risk/:country` | Risk score from ML service (e.g. `/risk/BD`)     |

---

## Sample API Responses

### `GET /api/analytics/dashboard`

```json
{
  "topExporters": [
    { "country": "China", "totalExportValue": 4800000 },
    { "country": "Germany", "totalExportValue": 3200000 }
  ],
  "topImporters": [
    { "country": "United States", "totalImportValue": 5100000 },
    { "country": "India", "totalImportValue": 2900000 }
  ]
}
```

### `GET /api/commodities/:id`

```json
{
  "_id": "...",
  "name": "Crude Oil",
  "category": "Energy",
  "unit": "barrel",
  "currentPrice": 82.5,
  "priceHistory": [
    { "date": "2025-03-01", "price": 79.2 },
    { "date": "2025-04-01", "price": 81.4 }
  ]
}
```

### `GET /api/analytics/risk/BD`

```json
{
  "country": "BD",
  "risk_score": 25.5,
  "level": "Low",
  "factors": ["Stable Trade Balance", "Low FX Volatility"]
}
```

---

## Instructions Per Member

### Member B (Frontend)

- Your API is live at `http://localhost:5000`
- Use `GET /api/analytics/dashboard` for the dashboard bar charts
- Use `GET /api/commodities/:id` for the price history line chart (the `priceHistory` array)
- Use `GET /api/countries` to populate any country dropdowns

### Member C (ML Service)

- Your workspace is `ml-service/`
- `main.py` is already bootstrapped with FastAPI + CORS
- Expand the risk scoring logic in `main.py`
- Add the `/api/risk/:country_code/breakdown` endpoint for Feature 9
- Run with: `python -m uvicorn main:app --reload`

### Member D (Orders & Payment)

- Your workspace is `backend/routes/orders.js` and `backend/routes/payment.js`
- Both files are already mounted in `server.js` — just add your route handlers
- Create `backend/models/Order.js` and `backend/models/User.js` for your schemas
- Order schema needs: `commodity`, `country`, `type` (buy/sell), `quantity`, `pricePerUnit`, `totalValue`, `status`
- User schema needs: `email`, `password`, `tier` (free/premium)

---

## Running Everything Together

Open **3 terminals**:

| Terminal | Command                                                | Service                 |
| -------- | ------------------------------------------------------ | ----------------------- |
| 1        | `cd backend && node server.js`                         | Backend API (port 5000) |
| 2        | `cd ml-service && python -m uvicorn main:app --reload` | ML Service (port 8000)  |
| 3        | `cd frontend && npm run dev`                           | Frontend (port 5173)    |

---

## Database

- **Provider:** MongoDB Atlas (cloud)
- **Database name:** `tradeai`
- **Collections:** `countries`, `commodities`, `traderecords`
- Pre-seeded with 5 countries, 5 commodities, 150 trade records
- To re-seed: `cd backend && node seed.js`
