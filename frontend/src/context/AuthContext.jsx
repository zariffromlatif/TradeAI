/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // <-- 1. Import useNavigate
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("tradeai_token"));
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate(); // <-- 2. Initialize the hook

  const isAuthenticated = !!user && !!token;

  // Axios instance with auth header
  const api = useCallback(() => {
    const instance = axios.create({ baseURL: API_BASE_URL });
    const savedToken = localStorage.getItem("tradeai_token");
    if (savedToken) {
      instance.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    }
    return instance;
  }, []);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const savedToken = localStorage.getItem("tradeai_token");
      if (!savedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        setUser(res.data);
        setToken(savedToken);
      } catch {
        localStorage.removeItem("tradeai_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password, rememberMe });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("tradeai_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, role = "buyer", adminCode = "") => {
    const body = { name, email, password, role };
    if (adminCode) body.adminCode = adminCode;
    const res = await axios.post(`${API_BASE_URL}/auth/register`, body);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("tradeai_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const refreshTokenClaims = async () => {
    const savedToken = localStorage.getItem("tradeai_token");
    if (!savedToken) return null;
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh-token-claims`,
      {},
      { headers: { Authorization: `Bearer ${savedToken}` } },
    );
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("tradeai_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

const logout = () => {
    // 1. Route to the public dashboard FIRST
    navigate("/dashboard", { replace: true });
    
    // 2. Wipe the session data a split-second later so ProtectedRoute doesn't panic
    setTimeout(() => {
      localStorage.removeItem("tradeai_token");
      setToken(null);
      setUser(null);
    }, 50); 
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, register, logout, api, refreshTokenClaims }}>
      {children}
    </AuthContext.Provider>
  );
}