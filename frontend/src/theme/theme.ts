export const THEME_STORAGE_KEY = "botanix-theme";
const THEME_MANUAL_KEY = "botanix-theme-manual";

export type Theme = "light" | "dark";

interface ThemePalette {
  background: string;
  header: string;
}

export const THEME_PALETTE: Record<Theme, ThemePalette> = {
  light: {
    background: "#F7F8F5",
    header: "#F7F8F5",
  },
  dark: {
    background: "#151914",
    header: "#151914",
  },
};

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function readStoredTheme(): Theme | null {
  try {
    const isManual = window.localStorage.getItem(THEME_MANUAL_KEY) === "1";

    if (!isManual) {
      return null;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isTheme(storedTheme)) {
      return storedTheme;
    }
  } catch {
    // Storage can be unavailable in private Telegram webviews.
  }

  return null;
}

export function getSystemTheme(): Theme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = readStoredTheme();

  if (storedTheme) {
    return storedTheme;
  }

  const telegramTheme = window.Telegram?.WebApp?.colorScheme;

  if (isTheme(telegramTheme)) {
    return telegramTheme;
  }

  return getSystemTheme();
}

export function readInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const domTheme = document.documentElement.dataset.theme;

    if (isTheme(domTheme)) {
      return domTheme;
    }
  }

  return resolveTheme();
}

export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_MANUAL_KEY, "1");
  } catch {
    // The theme still applies for the current session.
  }
}

export function applyTheme(theme: Theme): void {
  const palette = THEME_PALETTE[theme];
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", palette.background);
  }

  const webApp = window.Telegram?.WebApp;

  if (!webApp) {
    return;
  }

  try {
    webApp.setHeaderColor?.(palette.header);
    webApp.setBackgroundColor?.(palette.background);
  } catch {
    // Older Telegram clients may reject custom header colors.
  }
}
