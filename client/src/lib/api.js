import axios from "axios";

// In dev, Vite proxies "/api" to the local server (see vite.config.js).
// In production the frontend and backend are separate hosted services on
// different domains, so VITE_API_BASE_URL must point at the deployed API
// (e.g. https://medishare-api.onrender.com/api) — set at build time.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("medishare_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname.startsWith("/dashboard")) {
      localStorage.removeItem("medishare_token");
      localStorage.removeItem("medishare_admin");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function getErrorMessage(err) {
  return err.response?.data?.message || err.message || "Something went wrong";
}

export function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
