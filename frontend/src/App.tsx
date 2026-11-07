import { useEffect, useState } from "react";
import { getProfile } from "./api/endpoints";
import type { UserProfile } from "./api/types";

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((data) => setUser(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
      <h1 className="text-3xl font-bold text-emerald-400 mb-4">Botanix AI</h1>
      {user && (
        <p className="text-lg">
          Привет, <span className="font-semibold text-emerald-300">{user.first_name}</span> (ID: {user.telegram_id})
        </p>
      )}
      {error && <p className="text-red-400">Ошибка запроса к API: {error}</p>}
    </div>
  );
}

export default App;