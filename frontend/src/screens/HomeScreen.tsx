import { useEffect, useState } from "react";
import { Camera, MessageSquarePlus, MessageSquare, ChevronRight, Loader2, Sprout } from "lucide-react";
import { getChats } from "../api/endpoints";
import type { ChatItem } from "../api/types";

interface HomeScreenProps {
  onNavigateToIdentify: () => void;
  onOpenChat: (chatId: string) => void;
}

export function HomeScreen({ onNavigateToIdentify, onOpenChat }: HomeScreenProps) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchChats() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getChats();
        if (isMounted) {
          setChats(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.response?.data?.detail || "Не удалось загрузить историю диалогов");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchChats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 max-w-md mx-auto">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigateToIdentify}
          className="flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 active:scale-95 transition-all hover:bg-emerald-500/15"
        >
          <div className="p-2 rounded-xl bg-emerald-500/20">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold text-white">Определить вид</span>
        </button>

        <button
          onClick={() => onOpenChat("new")}
          className="flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 p-4 text-slate-200 active:scale-95 transition-all hover:bg-slate-800"
        >
          <div className="p-2 rounded-xl bg-slate-700/50">
            <MessageSquarePlus className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-white">Новый вопрос</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            История диалогов
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Всего: {chats.length}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Загружаем чаты...</span>
          </div>
        )}

        {!isLoading && !error && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 p-8 text-center gap-3">
            <div className="p-3 rounded-full bg-slate-800/60 text-slate-500">
              <Sprout className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-300">Диалогов пока нет</span>
              <p className="text-xs text-slate-500">
                Задайте вопрос ботанику или отправьте фото листа
              </p>
            </div>
          </div>
        )}

        {!isLoading && !error && chats.length > 0 && (
          <div className="flex flex-col gap-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onOpenChat(chat.id)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-white truncate">
                      {chat.title || "Диалог без названия"}
                    </span>
                    {chat.plant_context && (
                      <span className="text-xs text-emerald-400/80 truncate">
                        {chat.plant_context}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}