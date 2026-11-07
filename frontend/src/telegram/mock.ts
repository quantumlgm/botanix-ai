declare global {
  interface Window {
    Telegram?: {
      WebApp?: Record<string, any>;
    };
  }
}

export function setupTelegramMock(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  if (window.Telegram?.WebApp?.initData) {
    return;
  }

  const mockUser = {
    id: 123456789,
    first_name: "Developer",
    last_name: "Local",
    username: "botanix_dev",
    language_code: "ru",
  };

  const mockInitData = new URLSearchParams({
    user: JSON.stringify(mockUser),
    auth_date: Math.floor(Date.now() / 1000).toString(),
    hash: "mock_hash_for_dev_mode",
  }).toString();

  (window as any).Telegram = {
    WebApp: {
      initData: mockInitData,
      initDataUnsafe: {
        user: mockUser,
        auth_date: Math.floor(Date.now() / 1000),
        hash: "mock_hash_for_dev_mode",
      },

      ready: () => {
        console.log("[Telegram Mock] WebApp.ready() called");
      },
      expand: () => {
        console.log("[Telegram Mock] WebApp.expand() called");
      },
      close: () => {
        console.log("[Telegram Mock] WebApp.close() called");
      },
      themeParams: {
        bg_color: "#0f172a",
        text_color: "#ffffff",
        button_color: "#10b981",
        button_text_color: "#ffffff",
      },
      isExpanded: true,
      viewportHeight: window.innerHeight,
    },
  };

  console.warn(
    "[Telegram Mock] Environment initialized with mock Telegram WebApp data."
  );
}