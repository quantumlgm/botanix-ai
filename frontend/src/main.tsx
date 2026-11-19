import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource/cormorant-garamond/cyrillic-400-italic.css";
import "@fontsource/cormorant-garamond/cyrillic-500.css";
import "@fontsource/cormorant-garamond/cyrillic-500-italic.css";
import "@fontsource/cormorant-garamond/cyrillic-600.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "./index.css";
import App from "./App.tsx";
import { API_CONFIG_ERROR } from "./api/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FatalScreen } from "./components/FatalScreen";
import { initTelegramApp } from "./telegram/init.ts";
import { takeChatIdFromLocation } from "./telegram/deepLink.ts";
import { ThemeProvider } from "./theme/ThemeProvider";

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
    <ThemeProvider>
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
    </ThemeProvider>
  </StrictMode>
);
