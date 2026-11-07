import { ArrowLeft, User as UserIcon } from "lucide-react";
import type { Screen } from "../types/navigation";
import type { UserProfile } from "../api/types";

interface HeaderProps {
  currentScreen: Screen;
  user: UserProfile | null;
  onBack: () => void;
}

export function Header({ currentScreen, user, onBack }: HeaderProps) {
  const isHome = currentScreen === "home";

  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 backdrop-blur">
      {isHome ? (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white leading-tight">
              {user ? user.first_name : "Загрузка..."}
            </span>
            <span className="text-xs text-emerald-400">Botanix AI готов к работе</span>
          </div>
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

      <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
        Botanix
      </span>
    </header>
  );
}