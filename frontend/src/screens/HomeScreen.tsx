import { useEffect, useState, useRef } from "react";
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getChatMessages, createChat, streamChatMessage } from "../api/endpoints";
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!currentChatId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    async function fetchMessages() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getChatMessages(currentChatId!);
        if (isMounted) {
          setMessages(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.response?.data?.detail || "Не удалось загрузить историю сообщений");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [currentChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    const tempUserMsg: ChatMessage = {
      id: String(Date.now()),
      chat_id: currentChatId || "temp",
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputValue("");
    setIsSending(true);
    setError(null);

    const assistantMsgId = String(Date.now() + 1);

    try {
      let targetChatId = currentChatId;

      if (!targetChatId) {
        const newChat = await createChat(trimmed);
        targetChatId = newChat.chat_id;
        setCurrentChatId(targetChatId);
        onChatCreated?.(targetChatId);

        const initialAssistantMsg: ChatMessage = {
          id: assistantMsgId,
          chat_id: targetChatId,
          role: "assistant",
          content: newChat.reply,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, initialAssistantMsg]);
        setIsSending(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          chat_id: targetChatId!,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);

      await streamChatMessage(targetChatId, trimmed, (chunk: string) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      });
    } catch (err: any) {
      setError(err?.message || "Ошибка при передаче сообщения");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-md mx-auto">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Загрузка диалога...</span>
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3 text-slate-400">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              Задайте вопрос ботанику
            </p>
            <p className="text-xs text-slate-500">
              Например: «Почему сохнут кончики листьев у спатифиллума?»
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                  isUser
                    ? "bg-slate-700 text-slate-200"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none space-y-2 [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-emerald-400 [&>ul]:list-disc [&>ul]:pl-4 [&>p]:mb-1"
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Botanix печатает...</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="flex items-end gap-2 bg-slate-800/60 border border-slate-700 rounded-2xl p-1.5 focus-within:border-emerald-500/60 transition-colors">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите вопрос..."
            rows={1}
            disabled={isSending}
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none max-h-24"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}