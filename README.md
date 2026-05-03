# TradeAI

TradeAI is a full-stack global trade intelligence platform combining analytics, risk, forecasting, simulation, marketplace operations, and admin governance.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express + MongoDB (Mongoose)
- ML service: FastAPI + NumPy + scikit-learn

## Functional Modules

### Module 1 - Trade Intelligence & Data Management
- Dashboard analytics
- Commodity trend visualization
- Trade balance analytics
- Comparative intelligence
- Payment/tier upgrade workflows
- Admin dataset CRUD

### Module 2 - Prediction & Risk Analytics
- Predictive forecasting (trade volume + volatility endpoints)
- Automated risk scoring
- Risk interpretability

### Module 3 - Trade Operation & Decision Layer
- Simulated order lifecycle
- Profitability simulation
- Anomaly/fraud detection
- RFQ marketplace workflow

### Module 4 - Settlement, Reporting & Advisory
- Landed-cost/settlement simulation
- Advisory engine
- Report generation and PDF export
- In-app risk/alert notification mechanisms
- Stress test / sensitivity analysis

### Module 5 - Administration & Governance
- Admin dashboard overview stats
- User management views
- Payment request review/approval
- Orders and anomaly review tools
- Risk threshold and alert administration
- Admin report operations

## Access Tiers

- `silver` (default)
- `gold`
- `diamond`

Tier enforcement is handled in backend middleware and route guards.  
After tier changes, refresh claims via `POST /api/auth/refresh-token-claims`.

## Data Source Strategy

- Baseline trade sync: World Bank annual national totals (`syncTradeFlows.js`)
- Optional commodity expansion: UN Comtrade HS ingestion
- Compare page uses fallback behavior when commodity overlap is sparse

## Run Locally

See `WINDOWS_LOCAL_TESTING_GUIDE.md` for full setup.  
Quick start:

1. Install dependencies in `backend`, `frontend`, `ml-service`
2. Configure `backend/.env` from `backend/.env.example`
3. Start:
   - backend: `node server.js`
   - frontend: `npm run dev`
   - ml-service: `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`

## Required Backend Env Keys

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_INVITE_CODE`
- `CORS_ORIGINS`
- `ML_BASE_URL`

Payments:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_PUBLIC_URL`
- `STRIPE_GOLD_AMOUNT_CENTS`
- `STRIPE_DIAMOND_AMOUNT_CENTS`
- `DEMO_PAYMENT` (local/demo only)

Queue/report:
- `REDIS_URL`
- `REPORT_RETENTION_DAYS`
- `REPORT_CLEANUP_INTERVAL_MINUTES`

## Security Notes

- Never commit `.env` or secrets
- Keep `DEMO_PAYMENT=false` in production
- Use strict CORS and rotate secrets regularly