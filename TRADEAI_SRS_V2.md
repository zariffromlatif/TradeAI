# TradeAI SRS (Updated)

- Version: 2.1
- Date: May 2026
- Scope: Current implemented system baseline

## 1. System Request

### Business Need
Organizations and learners need a single platform to analyze trade intelligence, evaluate risk, simulate deal outcomes, and manage admin approval workflows.

### Business Requirements
- Integrate analytics, forecasting, risk, simulation, marketplace, and reporting in one system
- Support role-based access and tier-based feature controls
- Provide admin governance for datasets, users, payments, anomalies, and reports

### Business Value
- Faster and more informed trade decision-making
- Better transparency through explainable risk and data-source indicators
- Practical lab/demo readiness with local setup and fallback mechanisms

### Special Constraints
- External API data availability can vary by country/commodity
- ML-dependent features require a running ML service
- Queue/Redis may be unavailable in local environments (inline fallback required)

## 2. Technology

- Frontend: React, Vite, Tailwind, Recharts
- Backend: Node.js, Express, Mongoose, MongoDB
- ML Service: FastAPI, NumPy, scikit-learn
- Integrations: Stripe (optional live path), World Bank API, optional UN Comtrade API

## 3. Functional Requirements (Confirmed)

### Module 1 - Trade Intelligence & Data Management
1. Integrated dashboard analytics
2. Commodity trend visualization
3. Trade balance analytics
4. Comparative intelligence (country + commodity) with sparse-data fallback
5. Payment integration (manual/admin-approval flow + Stripe path)
6. Admin dataset CRUD (countries, commodities, trade records)

### Module 2 - Prediction & Risk Analytics
7. Forecasting engine (volume + volatility endpoints)
8. Automated risk scoring
9. Risk interpretability panel

### Module 3 - Trade Operation & Decision Layer
10. Simulated order workflow
11. Dynamic profitability simulation
12. Anomaly and fraud detection
13. RFQ marketplace flow
14. Stress test calculator

### Module 4 - Settlement, Reporting & Advisory
15. Landed-cost and settlement simulation
16. Advisory recommendation engine
17. Reports generation and PDF export
18. Risk/alert notifications

### Module 5 - Admin Panel
19. Admin dashboard summary
20. User management
21. Payment request review and tier approval
22. Orders and anomaly moderation
23. Risk threshold management
24. Report operations (generate, retry, cancel, download)

## 4. Access and Tier Rules

- Roles: user and admin
- User tiers: `silver`, `gold`, `diamond`
- Tier/role checks are enforced by backend middleware and protected routes
- Demo upgrade requests require admin approval before tier update

## 5. Non-Functional Notes

- Security: JWT auth, role/tier middleware, protected admin routes
- Reliability: report queue-first with inline fallback
- Data transparency: source labels and fallback indicators in analytics flows
- Maintainability: separated frontend/backend/ml-service with documented scripts
