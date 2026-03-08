from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/risk/{country_code}")
def get_country_risk(country_code: str):
    risk_weights = {"BD": 25.5, "IN": 30.2, "CN": 45.8}
    base = risk_weights.get(country_code.upper(), 50.0)
    return {
        "country": country_code,
        "risk_score": base,
        "level": "Low" if base < 40 else "Moderate",
        "factors": ["Stable Trade Balance", "Low FX Volatility"]
    }