import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, ArrowUp, Leaf } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createChat, getChatMessages, streamChatMessage } from "../api/endpoints";
import { getErrorMessage, isApiError } from "../api/errors";
import type { ChatMessage } from "../api/types";
import { BotanixMark } from "../components/BotanixMark";

type HistoryState = "loading" | "ready" | "error";
type ChatMessageStatus = "pending" | "error";
type UiChatMessage = ChatMessage & { status?: ChatMessageStatus };

interface ChatScreenProps {
  chatId: string | null;
  title?: string | null;
  onChatCreated?: (newChatId: string) => void;
  onBack?: () => void;
}

const QUICK_PROMPTS = [
  "Почему желтеют листья?",
  "Как часто поливать?",
  "Когда пересаживать?",
];

function normalizeChatId(chatId: string | null): string | null {
  return chatId && chatId !== "new" ? chatId : null;
}

function getHttpStatus(error: unknown): number | undefined {
  if (isApiError(error)) return error.status;
  return isAxiosError(error) ? error.response?.status : undefined;
}

function getHistoryErrorMessage(error: unknown): {
  message: string;
  fatal: boolean;
} {
  const status = getHttpStatus(error);

  if (status === 401) {
    return {
      message:
        "Не удалось подтвердить вход через Telegram. Закройте и откройте приложение заново.",
      fatal: true,
    };
  }

  if (status === 403) {
    return {
      message: "Нет доступа к этому диалогу.",
      fatal: true,
    };
  }

  if (status === 404 || status === 422) {
    return {
      message: "Диалог не найден или был удалён.",
      fatal: true,
    };
  }

  return {
    message: getErrorMessage(error, "Не удалось загрузить историю сообщений"),
    fatal: false,
  };
}

export function ChatScreen({
  chatId,
  title,
  onChatCreated,
  onBack,
}: ChatScreenProps) {
  const initialChatId = normalizeChatId(chatId);
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    initialChatId
  );
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [historyState, setHistoryState] = useState<HistoryState>(
    initialChatId ? "loading" : "ready"
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFatal, setHistoryFatal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);
  const sendingRef = useRef(false);
  const skipHistoryLoadForRef = useRef<string | null>(null);
  const historyRequestIdRef = useRef(0);
  const streamedTextRef = useRef("");
  const requestAbortRef = useRef<AbortController | null>(null);

  const headerTitle = title?.trim() || "AI-ботаник";

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!currentChatId) return;

    if (skipHistoryLoadForRef.current === currentChatId) {
      skipHistoryLoadForRef.current = null;
      return;
    }

    historyRequestIdRef.current += 1;
    const requestId = historyRequestIdRef.current;
    const controller = new AbortController();

    setMessages([]);
    setHistoryState("loading");
    setHistoryError(null);
    setHistoryFatal(false);

    getChatMessages(currentChatId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (historyRequestIdRef.current !== requestId) return;
        setMessages(
          data.map((message) => ({
            id: crypto.randomUUID(),
            role: message.role,
            content: message.content,
          }))
        );
        setHistoryState("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (historyRequestIdRef.current !== requestId) return;
        const { message, fatal } = getHistoryErrorMessage(err);
        setHistoryError(message);
        setHistoryFatal(fatal);
        setHistoryState("error");
      });

    return () => {
      controller.abort();
      historyRequestIdRef.current += 1;
    };
  }, [currentChatId, reloadKey]);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isNearBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [inputValue]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  };

  const handleRetryHistory = () => {
    setReloadKey((key) => key + 1);
  };

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || sendingRef.current || historyState !== "ready") return;

    sendingRef.current = true;
    isNearBottomRef.current = true;
    streamedTextRef.current = "";

    const controller = new AbortController();
    requestAbortRef.current = controller;

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const tempUserMessage: UiChatMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
    };
    const pendingAssistantMessage: UiChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "pending",
    };

    setMessages((previous) => [
      ...previous,
      tempUserMessage,
      pendingAssistantMessage,
    ]);
    setInputValue("");
    setIsSending(true);
    setError(null);

    try {
      let targetChatId = currentChatId;

      if (!targetChatId) {
        const newChat = await createChat(trimmed, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const createdChatId = newChat.chat_id;
        streamedTextRef.current = newChat.reply;
        skipHistoryLoadForRef.current = createdChatId;
        setCurrentChatId(createdChatId);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: newChat.reply,
                  status: newChat.reply.trim() ? undefined : "error",
                }
              : message
          )
        );
        onChatCreated?.(createdChatId);

        if (!newChat.reply.trim()) {
          setError("Модель не вернула ответ. Попробуйте ещё раз.");
        }

        return;
      }

      await streamChatMessage(
        targetChatId,
        trimmed,
        (chunk) => {
          if (controller.signal.aborted) return;
          streamedTextRef.current += chunk;
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: message.content + chunk,
                    status: undefined,
                  }
                : message
            )
          );
        },
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      if (!streamedTextRef.current.trim()) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== assistantMessageId)
        );
        setError("Модель не вернула ответ. Попробуйте ещё раз.");
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      if (streamedTextRef.current.trim()) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? { ...message, status: "error" }
              : message
          )
        );
      } else {
        setMessages((previous) =>
          previous.filter((message) => message.id !== assistantMessageId)
        );
      }
      setError(getErrorMessage(err, "Ошибка при передаче сообщения"));
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
      }
      sendingRef.current = false;
      if (!controller.signal.aborted) {
        setIsSending(false);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void handleSend();
    }
  };

  const isComposerDisabled = isSending || historyState !== "ready";
  const isFatalHistoryError = historyState === "error" && historyFatal;

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      <header className="safe-top shrink-0 border-b border-line/80 bg-canvas/95 px-4 backdrop-blur-md">
        <div className="grid h-14 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition active:scale-95"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <h1 className="min-w-0 truncate text-center font-serif text-[19px] leading-none font-semibold tracking-[-0.005em] text-ink">
            {headerTitle}
          </h1>

          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center justify-self-end rounded-xl bg-accent-soft text-accent"
          >
            <Leaf className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </span>
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-5 pb-2">
          {historyState === "loading" && (
            <div role="status" className="space-y-4">
              <span className="sr-only">Загрузка диалога…</span>
              <div aria-hidden="true" className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <span className="skeleton h-7 w-7 shrink-0 rounded-full" />
                  <span className="skeleton block h-20 w-[72%] rounded-2xl rounded-bl-sm" />
                </div>
                <div className="flex justify-end">
                  <span className="skeleton block h-10 w-[55%] rounded-2xl rounded-br-sm" />
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="skeleton h-7 w-7 shrink-0 rounded-full" />
                  <span className="skeleton block h-14 w-[64%] rounded-2xl rounded-bl-sm" />
                </div>
              </div>
            </div>
          )}

          {historyState === "error" && historyError && (
            <div
              role="alert"
              className="my-auto flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-6 text-center text-[12px] leading-relaxed text-muted shadow-card"
            >
              <AlertCircle className="h-5 w-5 text-danger" strokeWidth={1.7} />
              <p>{historyError}</p>
              {historyFatal ? (
                onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="mt-1 inline-flex h-10 items-center rounded-full border border-line px-4 text-[11.5px] font-semibold text-ink transition active:bg-surface-soft"
                  >
                    К диалогам
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleRetryHistory}
                  className="mt-1 inline-flex h-10 items-center rounded-full bg-primary px-4 text-[11.5px] font-semibold text-primary-ink transition active:scale-95"
                >
                  Повторить
                </button>
              )}
            </div>
          )}

          {historyState === "ready" && messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                <BotanixMark className="h-7 w-7" />
              </span>
              <h2 className="mt-5 font-serif text-[30px] leading-[1.05] font-semibold tracking-[-0.015em] text-ink">
                Спросите ботаника
              </h2>
              <p className="mt-2 max-w-[270px] text-[12.5px] leading-relaxed text-muted">
                О поливе, свете, пересадке и болезнях — спокойно и по делу.
              </p>

              <div className="mt-6 w-full max-w-[320px] border-l-2 border-accent/40 pl-4 text-left">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Например
                </p>
                <p className="mt-1.5 font-serif text-[18px] leading-snug text-ink">
                  «Почему сохнут кончики листьев у спатифиллума?»
                </p>
              </div>

              <div className="mt-5 flex max-w-[330px] flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => {
                      setInputValue(question);
                      textareaRef.current?.focus();
                    }}
                    className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-3.5 py-2 text-[11.5px] leading-none text-muted transition active:scale-95 active:border-accent/40 active:text-ink"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="flex flex-col gap-4">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const isPending = message.status === "pending";
                const isFailed = message.status === "error";

                return (
                  <div
                    key={message.id}
                    className={`animate-message flex items-start gap-2.5 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                      >
                        <BotanixMark className="h-4 w-4" />
                      </span>
                    )}

                    <div
                      className={`max-w-[82%] text-[14px] leading-[1.62] ${
                        isUser
                          ? "rounded-2xl rounded-br-sm bg-user-bubble px-4 py-2.5 text-ink"
                          : "rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3 text-ink shadow-card"
                      }`}
                    >
                      {isUser ? (
                        <p className="break-words whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : isPending ? (
                        <div className="flex items-center gap-2.5 text-muted">
                          <span className="flex items-center gap-1">
                            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent" />
                            <span
                              className="typing-dot h-1.5 w-1.5 rounded-full bg-accent"
                              style={{ animationDelay: "140ms" }}
                            />
                            <span
                              className="typing-dot h-1.5 w-1.5 rounded-full bg-accent"
                              style={{ animationDelay: "280ms" }}
                            />
                          </span>
                          <span className="text-[11px]">
                            Botanix печатает…
                          </span>
                        </div>
                      ) : message.content ? (
                        <>
                          <div className="botanix-markdown break-words">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {isFailed && (
                            <p className="mt-2 flex items-center gap-1 text-[10.5px] text-danger">
                              <AlertCircle
                                className="h-3 w-3 shrink-0"
                                strokeWidth={1.8}
                              />
                              Ответ прерван
                            </p>
                          )}
                        </>
                      ) : isFailed ? (
                        <p className="text-danger">Не удалось получить ответ.</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-center text-[11.5px] leading-relaxed text-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.7} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {!isFatalHistoryError && (
        <div className="safe-bottom-composer shrink-0 px-4 pt-2">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-end gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-4 shadow-card transition-colors focus-within:border-accent/45">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите вопрос…"
                rows={1}
                maxLength={700}
                enterKeyHint="send"
                aria-label="Сообщение"
                disabled={isComposerDisabled}
                className="max-h-24 min-h-[42px] flex-1 resize-none overflow-y-auto bg-transparent py-2.5 pr-1 text-[15px] leading-5 text-ink placeholder:text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isComposerDisabled}
                aria-label="Отправить сообщение"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-ink transition duration-200 active:scale-95 disabled:bg-surface-soft disabled:text-muted/45"
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
