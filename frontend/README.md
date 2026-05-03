# TradeAI Frontend

React + Vite application for TradeAI features.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:5173`

Set API base in `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Main Pages

- `/dashboard` - analytics overview
- `/commodities` - commodity trend charts
- `/compare` - country + commodity comparison (with sparse-data fallback)
- `/forecasts` - volume and volatility forecasts
- `/risk` and `/risk/breakdown` - risk scoring and interpretability
- `/orders` - RFQ marketplace and trade operation screens
- `/alerts` - anomaly notifications
- `/sim` - profitability, landed-cost, and stress test
- `/advisory` - recommendation engine
- `/plans` - user upgrade flow (manual + Stripe path)
- `/admin/*` - admin operations

## Notes

- Theme and global styles are managed in `src/index.css`.
- Pages are tier-aware and depend on backend authorization checks.
