import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { HomeScreen } from "./screens/HomeScreen";
import { IdentifyScreen } from "./screens/IdentifyScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { getProfile } from "./api/endpoints";
import { getErrorMessage } from "./api/errors";
import type { Screen } from "./types/navigation";
import type { UserProfile } from "./api/types";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((data) => setUser(data))
      .catch((err: unknown) => {
        setProfileError(
          getErrorMessage(err, "Не удалось загрузить профиль пользователя")
        );
      });
  }, []);

  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setCurrentScreen("chat");
  };

  const handleChatCreated = (chatId: string) => {
    setActiveChatId(chatId);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <Header
        currentScreen={currentScreen}
        user={user}
        profileError={profileError}
        onBack={() => setCurrentScreen("home")}
      />

      <main className="flex-1">
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
          <ChatScreen chatId={activeChatId} onChatCreated={handleChatCreated} />
        )}
      </main>
    </div>
  );
}

export default App;