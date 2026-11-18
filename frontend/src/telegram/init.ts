import { setupTelegramMock } from "./mock";
import { applyTheme, resolveTheme } from "../theme/theme";

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
  } catch {
    // Older Telegram clients may not support vertical swipe control.
  }

  applyTheme(resolveTheme());
}
