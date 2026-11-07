import axios from "axios";
import { API_BASE_URL } from "./config";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData;

  if (initData) {
    config.headers["X-Telegram-Init-Data"] = initData;
  }

  return config;
});