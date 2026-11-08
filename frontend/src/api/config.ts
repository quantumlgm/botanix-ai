const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV ? "http://localhost:8000" : "";

if (!configuredApiUrl && !import.meta.env.DEV) {
  throw new Error("VITE_API_URL must point to the FastAPI service in production.");
}

export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");
