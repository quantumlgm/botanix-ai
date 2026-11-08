import { setupTelegramMock } from "./mock";

export function initTelegramApp(): void {
  setupTelegramMock();

  const webApp = window.Telegram?.WebApp;

  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
}