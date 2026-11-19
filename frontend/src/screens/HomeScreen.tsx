import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  Camera,
  Leaf,
  Loader2,
  MessageCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { deleteChat, getChats } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import type { ChatItem, UserProfile } from "../api/types";
import { ThemeToggle } from "../components/ThemeToggle";

interface HomeScreenProps {
  user: UserProfile | null;
  profileError: string | null;
  onNavigateToIdentify: () => void;
  onOpenChat: (chatId: string, title?: string) => void;
}

function formatChatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function getInitial(user: UserProfile | null): string | null {
  const initial = user?.first_name?.trim().charAt(0).toUpperCase();
  return initial || null;
}

export function HomeScreen({
  user,
  profileError,
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

  const initial = getInitial(user);
  const profileLabel = profileError
    ? "Профиль недоступен"
    : user
      ? `Профиль: ${user.first_name}`
      : "Загрузка профиля";

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
    <div className="safe-bottom mx-auto w-full max-w-md px-6">
      <header className="safe-top">
        <div className="flex items-start justify-between gap-4 pt-3">
          <div className="min-w-0">
            <h1 className="truncate font-serif text-[34px] leading-none font-medium tracking-[-0.02em] text-ink">
              Botanix <span className="text-accent-ink">AI</span>
            </h1>
            <p className="mt-2 text-[11.5px] font-medium tracking-[0.02em] text-muted">
              ботанический помощник
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ThemeToggle />
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface"
              role="img"
              aria-label={profileLabel}
              title={profileLabel}
            >
              {initial ? (
                <span className="text-[12px] font-semibold text-ink">
                  {initial}
                </span>
              ) : (
                <UserRound className="h-[17px] w-[17px] text-muted" strokeWidth={1.6} />
              )}
              <span
                aria-hidden="true"
                className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas ${
                  profileError ? "bg-sand" : "bg-primary"
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mt-7 flex flex-col gap-2.5" aria-label="Действия">
        <button
          type="button"
          onClick={onNavigateToIdentify}
          className="flex h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[15px] font-semibold text-primary-ink shadow-float transition duration-200 active:scale-[0.985] active:brightness-[0.98]"
        >
          <Camera className="h-[19px] w-[19px]" strokeWidth={1.9} />
          Определить растение
        </button>

        <button
          type="button"
          onClick={() => onOpenChat("new", "AI-ботаник")}
          className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface/70 text-[13px] font-medium text-ink transition duration-200 active:scale-[0.99] active:bg-surface"
        >
          <MessageCircle className="h-[17px] w-[17px] text-accent-ink" strokeWidth={1.7} />
          Новый диалог с AI-ботаником
        </button>
      </section>

      <section className="mt-9" aria-labelledby="home-chats-title">
        <div className="flex items-baseline justify-between">
          <h2
            id="home-chats-title"
            className="font-serif text-[26px] leading-none font-semibold tracking-[-0.01em] text-ink"
          >
            Ваши диалоги
          </h2>
          {chats.length > 0 && (
            <span className="text-[12px] font-medium tabular-nums text-muted">
              {chats.length}
            </span>
          )}
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-2xl bg-danger-soft p-3.5 text-[12px] leading-relaxed text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span>{errorMessage}</span>
              {loadError && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="self-start text-[11.5px] font-semibold underline underline-offset-2 disabled:opacity-50"
                >
                  Повторить
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div role="status" className="mt-2">
            <span className="sr-only">Загрузка диалогов…</span>
            <ul aria-hidden="true" className="divide-y divide-line">
              {[0, 1, 2].map((item) => (
                <li key={item} className="flex items-center gap-3.5 py-3.5">
                  <span className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
                  <span className="min-w-0 flex-1">
                    <span className="skeleton block h-3 w-2/3 rounded-full" />
                    <span className="skeleton mt-2 block h-2.5 w-1/3 rounded-full" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : chats.length === 0 && !loadError ? (
          <div className="mt-5 flex flex-col items-center border-t border-line py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Leaf className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <h3 className="mt-4 font-serif text-[24px] leading-tight font-semibold text-ink">
              Пока здесь тихо
            </h3>
            <p className="mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-muted">
              Сфотографируйте растение — здесь появятся ваши диалоги и заметки
              о нём.
            </p>
          </div>
        ) : chats.length > 0 ? (
          <ul className="mt-1 divide-y divide-line">
            {chats.map((chat) => {
              const isConfirming = confirmDeleteChatId === chat.id;
              const isDeleting = deletingChatId === chat.id;

              return (
                <li key={chat.id}>
                  {isConfirming ? (
                    <div className="flex items-center gap-2 py-3.5">
                      <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                        Удалить диалог?
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteChat(chat.id)}
                        disabled={deletingChatId !== null}
                        className="h-9 shrink-0 rounded-full bg-danger-soft px-3.5 text-[11.5px] font-semibold text-danger transition active:scale-95 disabled:opacity-50"
                      >
                        Удалить
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChatId(null)}
                        className="h-9 shrink-0 rounded-full px-3 text-[11.5px] font-medium text-muted transition active:bg-surface-soft"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 py-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenChat(chat.id, chat.title)}
                        disabled={isDeleting}
                        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl text-left disabled:opacity-60"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            chat.plant_context
                              ? "bg-accent-soft text-accent"
                              : "bg-surface-soft text-muted"
                          }`}
                        >
                          {chat.plant_context ? (
                            <Leaf
                              className="h-[22px] w-[22px]"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <MessageCircle
                              className="h-[22px] w-[22px]"
                              strokeWidth={1.5}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-semibold tracking-[-0.005em] text-ink">
                            {chat.title || "Диалог о растении"}
                          </span>
                          <span className="mt-1 block truncate text-[11.5px] text-muted">
                            {formatChatDate(chat.created_at)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Удалить диалог ${chat.title || "о растении"}`}
                        disabled={deletingChatId !== null}
                        onClick={() => setConfirmDeleteChatId(chat.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted/70 transition active:scale-95 active:bg-danger-soft active:text-danger disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.7} />
                        ) : (
                          <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                        )}
                      </button>
                    </div>
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
