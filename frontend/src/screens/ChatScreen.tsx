import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AlertCircle, Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createChat, getChatMessages, streamChatMessage } from "../api/endpoints";
import { getErrorMessage } from "../api/errors";
import type { ChatMessage } from "../api/types";

interface ChatScreenProps {
  chatId: string | null;
  onChatCreated?: (newChatId: string) => void;
}

export function ChatScreen({ chatId, onChatCreated }: ChatScreenProps) {
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chatId === "new" ? null : chatId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(
    chatId !== null && chatId !== "new"
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentChatId) return;

    let isMounted = true;

    getChatMessages(currentChatId)
      .then((data) => {
        if (isMounted) {
          setMessages(
            data.map((message) => ({
              id: crypto.randomUUID(),
              role: message.role,
              content: message.content,
            }))
          );
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            getErrorMessage(err, "Не удалось загрузить историю сообщений")
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const tempUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
    };

    setMessages((previous) => [...previous, tempUserMessage]);
    setInputValue("");
    setIsSending(true);
    setError(null);

    try {
      let targetChatId = currentChatId;

      if (!targetChatId) {
        const newChat = await createChat(trimmed);
        const createdChatId = newChat.chat_id;
        targetChatId = createdChatId;
        setIsLoading(true);
        setCurrentChatId(createdChatId);
        onChatCreated?.(createdChatId);
        setMessages((previous) => [
          ...previous,
          {
            id: assistantMessageId,
            role: "assistant",
            content: newChat.reply,
          },
        ]);
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ]);

      await streamChatMessage(targetChatId, trimmed, (chunk) => {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      });
    } catch (err: unknown) {
      setMessages((previous) =>
        previous.filter((message) => message.id !== assistantMessageId)
      );
      setError(getErrorMessage(err, "Ошибка при передаче сообщения"));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-md flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="text-xs">Загрузка диалога...</span>
          </div>
        )}

        {!isLoading && messages.length === 0 && (
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : message.content ? (
                <div className="overflow-x-auto [&_a]:text-emerald-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-500 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-900/70 [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900/70 [&_pre]:p-2 [&_strong]:font-bold [&_em]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-600 [&_th]:bg-slate-700/60 [&_th]:px-2 [&_th]:py-1.5 [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    <span>Botanix печатает...</span>
                  </div>
                )}
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

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-800 bg-slate-900/90 p-3 backdrop-blur">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-1.5 transition-colors focus-within:border-emerald-500/60">
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите вопрос..."
            rows={1}
            disabled={isSending || isLoading}
            className="max-h-24 flex-1 resize-none bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isSending || isLoading}
            aria-label="Отправить сообщение"
            className="shrink-0 rounded-xl bg-emerald-500 p-2 font-semibold text-slate-950 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
