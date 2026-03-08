// frontend/src/App.jsx
import { useEffect, useState } from "react";
import axios from "axios";

// Inside your App component:
const [riskData, setRiskData] = useState({ score: "--", level: "Loading..." });

useEffect(() => {
  const fetchRisk = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/analytics/risk/BD",
      );
      setRiskData({ score: res.data.risk_score, level: res.data.level });
    } catch (err) {
      console.error("Link to bridge failed");
    }
  };
  fetchRisk();
}, []);

// Update your StatCard call:
<StatCard
  icon={<Shield className="text-emerald-400" />}
  title="Risk Index"
  value={`${riskData.level} (${riskData.score})`}
/>;
