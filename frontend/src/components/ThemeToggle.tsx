import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent transition duration-300 active:scale-95"
    >
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        <Sun
          className={`absolute h-[18px] w-[18px] transition duration-300 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
          strokeWidth={1.7}
        />
        <Moon
          className={`absolute h-[17px] w-[17px] transition duration-300 ${
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
          strokeWidth={1.7}
        />
      </span>
    </button>
  );
}
