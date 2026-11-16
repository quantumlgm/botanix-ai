import { setupTelegramMock } from "./mock";

const APP_BACKGROUND_COLOR = "#0f172a";

export function initTelegramApp(): void {
  setupTelegramMock();

  const webApp = window.Telegram?.WebApp;

  if (!webApp) {
    return;
  }

  webApp.ready();
  webApp.expand();

  try {
    if (typeof webApp.disableVerticalSwipes === "function") {
      webApp.disableVerticalSwipes();
    }

    if (typeof webApp.setHeaderColor === "function") {
      webApp.setHeaderColor(APP_BACKGROUND_COLOR);
    }

    if (typeof webApp.setBackgroundColor === "function") {
      webApp.setBackgroundColor(APP_BACKGROUND_COLOR);
    }
  } catch {
  }
}
