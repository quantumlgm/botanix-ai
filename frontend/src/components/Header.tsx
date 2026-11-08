import { ArrowLeft } from "lucide-react";
import type { Screen } from "../types/navigation";
import type { UserProfile } from "../api/types";

interface HeaderProps {
  currentScreen: Screen;
  user: UserProfile | null;
  profileError: string | null;
  onBack: () => void;
}

export function Header({
  currentScreen,
  user,
  profileError,
  onBack,
}: HeaderProps) {
  const isHome = currentScreen === "home";

  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 backdrop-blur">
      {isHome ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold leading-tight text-white">
            {user?.first_name || (profileError ? "Профиль недоступен" : "Загрузка...")}
          </span>
          <span
            className={
              profileError
                ? "truncate text-xs text-red-400"
                : "truncate text-xs text-emerald-400"
            }
          >
            {profileError
              ? "Не удалось загрузить профиль"
              : user?.username
                ? `@${user.username}`
                : "Botanix AI готов к работе"}
          </span>
        </div>
      ) : (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white active:scale-95 transition"
        >
          <ArrowLeft className="h-5 w-5 text-emerald-400" />
          <span>Назад</span>
        </button>
      )}

      <img
        src="/big-logo.png"
        alt="Botanix AI"
        className="ml-3 h-7 w-auto max-w-[112px] shrink-0 object-contain sm:h-8"
      />
    </header>
  );
}