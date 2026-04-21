# TradeAI Local Setup (Windows PowerShell)

This guide helps anyone run and test TradeAI on a local Windows machine.

## 0) Prerequisites

Install these first:

- Git
- Node.js 18+
- Python 3.10+ (3.12 recommended)

## 1) Clone project

```powershell
git clone https://github.com/zariffromlatif/TradeAI.git
cd TradeAI
```

## 2) Install dependencies

```powershell
cd backend
npm install
cd ..

cd frontend
npm install
cd ..

cd ml-service
pip install -r requirements.txt
cd ..
```

## 3) Create env files

### Backend env

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

Set at least these values in `backend/.env`:

```env
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_long_random_secret
CORS_ORIGINS=http://localhost:5173
```

Optional:

```env
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
DEMO_PAYMENT=true
```

### Frontend env

```powershell
Copy-Item frontend\.env.example frontend\.env
notepad frontend\.env
```

Set:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 4) Seed + sync real data

```powershell
cd backend
node seed.js
node scripts\syncTradeFlows.js
node scripts\syncFxRates.js
cd ..
```

## 5) Run app (open 3 PowerShell windows)

### Window 1 - Backend

```powershell
cd path\to\TradeAI\backend
node server.js
```

Expected output: `Server on port 5000`

### Window 2 - ML service

```powershell
cd path\to\TradeAI\ml-service
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Expected output: Uvicorn running on `http://127.0.0.1:8000`

### Window 3 - Frontend

```powershell
cd path\to\TradeAI\frontend
npm run dev
```

Open in browser: [http://localhost:5173](http://localhost:5173)

## 6) Smoke test checklist

- Dashboard loads charts
- Compare page shows data and official/fallback badge
- Forecast page shows volume forecast and FX volatility
- Risk pages load (when ML service is running)
- Alerts/Orders pages open without API errors

## 7) Troubleshooting

- Risk or forecast returns 500:
  - ML service is likely not running on port 8000
- Blank compare or forecast:
  - Re-run:

    ```powershell
    cd backend
    node scripts\syncTradeFlows.js
    ```

- No FX pairs:
  - Run:

    ```powershell
    cd backend
    node scripts\syncFxRates.js
    ```

- CORS issues:
  - Ensure `backend/.env` includes:

    ```env
    CORS_ORIGINS=http://localhost:5173
    ```
