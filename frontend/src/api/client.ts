import axios from "axios";
import { API_BASE_URL } from "./config";

export const DEFAULT_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 90_000;
export const CHAT_CREATE_TIMEOUT_MS = 120_000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

apiClient.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData;

  if (initData) {
    config.headers["X-Telegram-Init-Data"] = initData;
  }

  return config;
});
