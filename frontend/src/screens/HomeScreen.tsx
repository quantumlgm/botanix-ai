import { Camera, MessageSquarePlus } from "lucide-react";

interface HomeScreenProps {
  onNavigateToIdentify: () => void;
  onOpenChat: (chatId: string) => void;
}

export function HomeScreen({ onNavigateToIdentify, onOpenChat }: HomeScreenProps) {
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Секция быстрых действий */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigateToIdentify}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 active:scale-95 transition"
        >
          <Camera className="w-7 h-7" />
          <span className="text-sm font-medium">Определить вид</span>
        </button>

        <button
          onClick={() => onOpenChat("new")}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-800/80 border border-slate-700/60 p-4 text-slate-200 active:scale-95 transition"
        >
          <MessageSquarePlus className="w-7 h-7 text-emerald-400" />
          <span className="text-sm font-medium">Новый вопрос</span>
        </button>
      </div>

      {/* Заглушка списка чатов */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-300">История чатов</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-center text-sm text-slate-400">
          Чаты пока не загружены...
        </div>
      </div>
    </div>
  );
}