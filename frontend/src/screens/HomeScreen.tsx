import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(
    null
  );
  const [reloadKey, setReloadKey] = useState(0);
  const deleteAbortRef = useRef<AbortController | null>(null);

  const loadChats = useCallback(async (signal: AbortSignal) => {
    try {
      const data = await getChats({ signal });
      if (signal.aborted) return;
      setChats(data);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setLoadError(
        getErrorMessage(err, "Не удалось загрузить список диалогов")
      );
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      await loadChats(controller.signal);
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [loadChats, reloadKey]);

  useEffect(() => {
    return () => {
      deleteAbortRef.current?.abort();
      deleteAbortRef.current = null;
    };
  }, []);

  const removeChat = (chatId: string) => {
    setChats((currentChats) =>
      currentChats.filter((chat) => chat.id !== chatId)
    );
  };

  const handleDeleteChat = async (chatId: string) => {
    if (deletingChatId !== null) return;

    setConfirmDeleteChatId(null);
    setDeletingChatId(chatId);
    setDeleteError(null);

    const controller = new AbortController();
    deleteAbortRef.current = controller;

    try {
      await deleteChat(chatId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      removeChat(chatId);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      if (isAxiosError(err) && err.response?.status === 404) {
        removeChat(chatId);
        return;
      }

      setDeleteError(getErrorMessage(err, "Не удалось удалить диалог"));
    } finally {
      if (deleteAbortRef.current === controller) {
        deleteAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setDeletingChatId(null);
      }
    }
  };

  const handleRetry = () => {
    setDeleteError(null);
    setLoadError(null);
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const errorMessage = loadError ?? deleteError;

  return (
    <div className="safe-bottom mx-auto flex max-w-md flex-col gap-5 p-4">
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

        {errorMessage && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span>{errorMessage}</span>
              {loadError && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="h-10 self-start rounded-lg border border-red-400/40 px-4 font-medium text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Повторить
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span className="text-xs">Загрузка диалогов...</span>
          </div>
        ) : chats.length === 0 && !loadError ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-800/30 p-8 text-center">
            <MessageCircle className="h-7 w-7 text-emerald-400" />
            <p className="text-sm text-slate-200">Пока нет диалогов</p>
            <p className="text-xs text-slate-500">
              Начните новый разговор или сначала определите растение
            </p>
          </div>
        ) : chats.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {chats.map((chat) => {
              const isConfirming = confirmDeleteChatId === chat.id;
              const isDeleting = deletingChatId === chat.id;

              return (
                <li
                  key={chat.id}
                  className="flex items-center gap-1 rounded-2xl border border-slate-800 bg-slate-800/40 p-1 transition hover:border-emerald-500/40"
                >
                  {isConfirming ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5 pl-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        Удалить диалог?
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChat(chat.id)}
                        disabled={deletingChatId !== null}
                        className="h-10 shrink-0 rounded-lg bg-red-500/15 px-3 text-xs font-medium text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChatId(null)}
                        className="h-10 shrink-0 rounded-lg px-3 text-xs font-medium text-slate-300 transition hover:bg-slate-700/60"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenChat(chat.id)}
                        disabled={isDeleting}
                        className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left disabled:opacity-60"
                      >
                        <MessageCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-200">
                            {chat.title || "Диалог о растении"}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {chat.plant_context ||
                              new Date(chat.created_at).toLocaleDateString(
                                "ru-RU"
                              )}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Удалить диалог"
                        disabled={deletingChatId !== null}
                        onClick={() => setConfirmDeleteChatId(chat.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Trash2 className="h-5 w-5" />
                        )}
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
