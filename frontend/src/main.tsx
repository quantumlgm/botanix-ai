import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { API_CONFIG_ERROR } from "./api/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FatalScreen } from "./components/FatalScreen";
import { initTelegramApp } from "./telegram/init.ts";
import { takeChatIdFromLocation } from "./telegram/deepLink.ts";

try {
  initTelegramApp();
} catch (error) {
  console.error("Failed to initialize Telegram WebApp", error);
}

const initialChatId = takeChatIdFromLocation();
const isTelegramRequired = !import.meta.env.DEV && !window.Telegram?.WebApp;

if (API_CONFIG_ERROR) {
  console.error(API_CONFIG_ERROR);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {API_CONFIG_ERROR ? (
      <FatalScreen
        title="Приложение не настроено"
        message="Не удалось определить адрес сервера. Попробуйте открыть приложение позже или сообщите об ошибке администратору."
      />
    ) : isTelegramRequired ? (
      <FatalScreen
        title="Откройте приложение через Telegram"
        message="Botanix доступен только внутри Telegram Mini App. Запустите его из чата с ботом."
      />
    ) : (
      <ErrorBoundary>
        <App initialChatId={initialChatId} />
      </ErrorBoundary>
    )}
  </StrictMode>
);
