interface ChatScreenProps {
  chatId: string | null;
}

export function ChatScreen({ chatId }: ChatScreenProps) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Лента сообщений чата (ID: {chatId || "новый"})
      </div>
    </div>
  );
}