import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { HomeScreen } from "./screens/HomeScreen";
import { IdentifyScreen } from "./screens/IdentifyScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { getProfile } from "./api/endpoints";
import type { Screen } from "./types/navigation";
import type { UserProfile } from "./api/types";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile()
      .then((data) => setUser(data))
      .catch((err) => console.error("Failed to load profile:", err));
  }, []);

  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setCurrentScreen("chat");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <Header
        currentScreen={currentScreen}
        user={user}
        onBack={() => setCurrentScreen("home")}
      />

      <main className="flex-1">
        {currentScreen === "home" && (
          <HomeScreen
            onNavigateToIdentify={() => setCurrentScreen("identify")}
            onOpenChat={handleOpenChat}
          />
        )}
        {currentScreen === "identify" && <IdentifyScreen />}
        {currentScreen === "chat" && <ChatScreen chatId={activeChatId} />}
      </main>
    </div>
  );
}

export default App;