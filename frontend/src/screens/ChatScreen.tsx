import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createChat, getChatMessages, streamChatMessage } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import type { ChatMessage } from "../api/types";

type HistoryState = "loading" | "ready" | "error";
type ChatMessageStatus = "pending" | "error";
type UiChatMessage = ChatMessage & { status?: ChatMessageStatus };

interface ChatScreenProps {
  chatId: string | null;
  onChatCreated?: (newChatId: string) => void;
  onBack?: () => void;
}

function normalizeChatId(chatId: string | null): string | null {
  return chatId && chatId !== "new" ? chatId : null;
}

function getHttpStatus(error: unknown): number | undefined {
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

export function ChatScreen({ chatId, onChatCreated, onBack }: ChatScreenProps) {
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

  useEffect(() => {
    if (!currentChatId) return;

    if (skipHistoryLoadForRef.current === currentChatId) {
      skipHistoryLoadForRef.current = null;
      return;
    }

    historyRequestIdRef.current += 1;
    const requestId = historyRequestIdRef.current;

    setMessages([]);
    setHistoryState("loading");
    setHistoryError(null);
    setHistoryFatal(false);

    getChatMessages(currentChatId)
      .then((data) => {
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
        if (historyRequestIdRef.current !== requestId) return;
        const { message, fatal } = getHistoryErrorMessage(err);
        setHistoryError(message);
        setHistoryFatal(fatal);
        setHistoryState("error");
      });

    return () => {
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
        const newChat = await createChat(trimmed);
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

      await streamChatMessage(targetChatId, trimmed, (chunk) => {
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
      });

      if (!streamedTextRef.current.trim()) {
        setMessages((previous) =>
          previous.filter((message) => message.id !== assistantMessageId)
        );
        setError("Модель не вернула ответ. Попробуйте ещё раз.");
      }
    } catch (err: unknown) {
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
      sendingRef.current = false;
      setIsSending(false);
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
    <div className="mx-auto flex h-full max-w-md flex-col">
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4"
      >
        {historyState === "loading" && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="text-xs">Загрузка диалога...</span>
          </div>
        )}

        {historyState === "error" && historyError && (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-xs text-red-400"
          >
            <AlertCircle className="h-5 w-5" />
            <p>{historyError}</p>
            {historyFatal ? (
              onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg border border-red-400/40 px-3 py-1.5 font-medium text-red-300 transition hover:bg-red-500/10"
                >
                  К диалогам
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleRetryHistory}
                className="rounded-lg border border-emerald-500/40 px-3 py-1.5 font-medium text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Повторить
              </button>
            )}
          </div>
        )}

        {historyState === "ready" && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Задайте вопрос ботанику
            </p>
            <p className="text-xs text-slate-500">
              Например: «Почему сохнут кончики листьев у спатифиллума?»
            </p>
          </div>
        )}

        {messages.map((message) => {
          const isUser = message.role === "user";
          const isPending = message.status === "pending";
          const isFailed = message.status === "error";

          return (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                  isUser
                    ? "bg-slate-700 text-slate-200"
                    : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {isUser ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? "rounded-tr-none bg-emerald-600 text-white"
                    : "space-y-2 rounded-tl-none border border-slate-700/60 bg-slate-800/80 text-slate-200 [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-emerald-400 [&>ul]:list-disc [&>ul]:pl-4 [&>p]:mb-1"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                ) : isPending ? (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    <span>Botanix печатает...</span>
                  </div>
                ) : message.content ? (
                  <>
                    <div className="overflow-x-auto break-words [&_a]:text-emerald-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-500 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-900/70 [&_code]:px-1 [&_img]:h-auto [&_img]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900/70 [&_pre]:p-2 [&_strong]:font-bold [&_em]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-600 [&_th]:bg-slate-700/60 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    {isFailed && (
                      <p className="flex items-center gap-1 text-[11px] text-red-300">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        Ответ прерван
                      </p>
                    )}
                  </>
                ) : isFailed ? (
                  <p className="text-red-300">Не удалось получить ответ.</p>
                ) : null}
              </div>
            </div>
          );
        })}

        {error && (
          <div
            role="alert"
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-center text-xs text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {!isFatalHistoryError && (
        <div className="safe-bottom-composer shrink-0 border-t border-slate-800 bg-slate-900/90 p-3 backdrop-blur">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-1.5 transition-colors focus-within:border-emerald-500/60">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите вопрос..."
              rows={1}
              maxLength={700}
              enterKeyHint="send"
              aria-label="Сообщение"
              disabled={isComposerDisabled}
              className="max-h-24 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-1.5 text-base leading-5 text-white placeholder-slate-500 focus:outline-none sm:text-sm"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || isComposerDisabled}
              aria-label="Отправить сообщение"
              className="shrink-0 rounded-xl bg-emerald-500 p-2 font-semibold text-slate-950 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
