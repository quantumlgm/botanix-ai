const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV ? "http://localhost:8000" : "";

export const API_CONFIG_ERROR =
  !configuredApiUrl && !import.meta.env.DEV
    ? "VITE_API_URL is not configured for the production build."
    : null;

export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");
