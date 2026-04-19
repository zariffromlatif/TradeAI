# TradeAI Frontend

React + Vite SPA for analytics, forecasting, risk, simulation, advisory, and marketplace workflows.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and calls backend APIs at `http://localhost:5000/api`.
Set API base via `frontend/.env` (see `frontend/.env.example`) using `VITE_API_BASE_URL`.

## Main pages

- `Dashboard` (`/dashboard`) — KPI cards and import/export charts
- `Commodities` (`/commodities`) — trend visualization and provenance
- `Compare` (`/compare`) — dual-country comparison
- `Forecasts` (`/forecasts`) — trade-volume forecast + real FX volatility
- `Advisory` (`/advisory`) — rule-based recommendations
- `Marketplace` (`/orders`) — RFQ board, quote flow, and deal settlement tracking
- `Risk score` / `Risk explain` (`/risk`, `/risk/breakdown`)
- `Simulation` (`/sim`) and payment/premium routes

## Key implementation notes

- Theme: monochrome UI with subtle accent, shared utility classes in `src/index.css`.
- Charts: Recharts-based, tuned for dark contrast/readability.
- Forecast volatility now uses real FX pairs from backend `GET /api/analytics/fx/pairs`.
- Marketplace actions now use Bearer JWT (no `x-user-id` headers); role-based behavior is enforced by backend.
- Dashboard supports verified-data fallback mode and empty-state messaging when verified records are unavailable.
