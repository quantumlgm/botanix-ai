import { useCallback, useEffect, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { IdentifyScreen } from "./screens/IdentifyScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { getProfile } from "./api/endpoints";
import { getErrorMessage } from "./api/errors";
import type { Screen } from "./types/navigation";
import type { UserProfile } from "./api/types";

interface AppProps {
  initialChatId?: string | null;
}

function App({ initialChatId = null }: AppProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    initialChatId ? "chat" : "home"
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(
    initialChatId
  );
  const [activeChatTitle, setActiveChatTitle] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    setCurrentScreen("home");
    setActiveChatId(null);
    setActiveChatTitle(null);
  }, []);

  useEffect(() => {
    getProfile()
      .then((data) => setUser(data))
      .catch((err: unknown) => {
        setProfileError(
          getErrorMessage(err, "Не удалось загрузить профиль пользователя")
        );
      });
  }, []);

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;

    if (!backButton) {
      return;
    }

    if (currentScreen === "home") {
      backButton.hide();
      return;
    }

    backButton.onClick(handleBack);
    backButton.show();

    return () => {
      backButton.offClick(handleBack);
      backButton.hide();
    };
  }, [currentScreen, handleBack]);

  const handleOpenChat = (chatId: string, title?: string) => {
    setActiveChatId(chatId);
    setActiveChatTitle(title ?? null);
    setCurrentScreen("chat");
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
  };

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden text-ink">
      <main
        className={
          currentScreen === "home"
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
            : "min-h-0 flex-1 overflow-hidden"
        }
      >
        {currentScreen === "home" && (
          <HomeScreen
            user={user}
            profileError={profileError}
            onNavigateToIdentify={() => setCurrentScreen("identify")}
            onOpenChat={handleOpenChat}
          />
        )}
        {currentScreen === "identify" && (
          <IdentifyScreen
            onBack={handleBack}
            onOpenChat={handleOpenChat}
          />
        )}
        {currentScreen === "chat" && (
          <ChatScreen
            chatId={activeChatId}
            title={activeChatTitle}
            onChatCreated={handleChatCreated}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
}

export default App;
