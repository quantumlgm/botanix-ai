import { useEffect, useState } from "react";
import {
  AlertCircle,
  Camera,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { deleteChat, getChats } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import type { ChatItem } from "../api/types";

interface HomeScreenProps {
  onNavigateToIdentify: () => void;
  onOpenChat: (chatId: string) => void;
}

export function HomeScreen({
  onNavigateToIdentify,
  onOpenChat,
}: HomeScreenProps) {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getChats()
      .then((data) => {
        if (isMounted) setChats(data);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(getErrorMessage(err, "Не удалось загрузить список диалогов"));
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeleteChat = async (chatId: string) => {
    setDeletingChatId(chatId);
    setError(null);
    try {
      await deleteChat(chatId);
      setChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Не удалось удалить диалог"));
    } finally {
      setDeletingChatId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-4">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onNavigateToIdentify}
          className="flex w-full items-center gap-4 rounded-2xl bg-emerald-500 p-5 text-left text-slate-950 shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950/10">
            <Camera className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-bold">Определить растение</span>
            <span className="mt-1 block text-xs text-slate-900/75">
              Сделайте фото или выберите снимок
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onOpenChat("new")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50"
        >
          <Plus className="h-4 w-4" />
          Новый диалог
        </button>
      </div>

      <section>
        <h1 className="mb-3 text-sm font-semibold text-slate-300">Ваши диалоги</h1>

        {error && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span className="text-xs">Загрузка диалогов...</span>
          </div>
        ) : chats.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
            <MessageCircle className="h-7 w-7 text-emerald-400" />
            <p className="text-sm text-slate-200">Пока нет диалогов</p>
            <p className="text-xs text-slate-500">
              Начните новый разговор или сначала определите растение
            </p>
          </div>
        ) : chats.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {chats.map((chat) => (
              <li
                key={chat.id}
                className="flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-800/40 p-1 transition hover:border-emerald-500/40"
              >
                <button
                  type="button"
                  onClick={() => onOpenChat(chat.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
                >
                  <MessageCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200">
                      {chat.title || "Диалог о растении"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {chat.plant_context || new Date(chat.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Удалить диалог"
                  disabled={deletingChatId !== null}
                  onClick={() => void handleDeleteChat(chat.id)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  {deletingChatId === chat.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
