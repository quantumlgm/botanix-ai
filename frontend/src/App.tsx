import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    setCurrentScreen("home");
    setActiveChatId(null);
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

  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setCurrentScreen("chat");
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-900 text-white">
      <Header
        currentScreen={currentScreen}
        user={user}
        profileError={profileError}
        onBack={handleBack}
      />

      <main
        className={
          currentScreen === "chat"
            ? "min-h-0 flex-1 overflow-hidden"
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain"
        }
      >
        {currentScreen === "home" && (
          <HomeScreen
            onNavigateToIdentify={() => setCurrentScreen("identify")}
            onOpenChat={handleOpenChat}
          />
        )}
        {currentScreen === "identify" && (
          <IdentifyScreen onOpenChat={handleOpenChat} />
        )}
        {currentScreen === "chat" && (
          <ChatScreen
            chatId={activeChatId}
            onChatCreated={handleChatCreated}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
}

export default App;