const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV
  ? "http://localhost:8000"
  : window.location.origin;

export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");
