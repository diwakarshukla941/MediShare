import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem("medishare_admin");
    return raw ? JSON.parse(raw) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("medishare_token");
    if (!token) {
      setReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => {
        setAdmin(data.admin);
        localStorage.setItem("medishare_admin", JSON.stringify(data.admin));
      })
      .catch(() => {
        localStorage.removeItem("medishare_token");
        localStorage.removeItem("medishare_admin");
        setAdmin(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("medishare_token", data.token);
    localStorage.setItem("medishare_admin", JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("medishare_token");
    localStorage.removeItem("medishare_admin");
    setAdmin(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, ready, login, logout, isAuthenticated: Boolean(admin) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
