const CHAT_ID_PARAM = "chat_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function takeChatIdFromLocation(): string | null {
  try {
    const url = new URL(window.location.href);
    const rawChatId = url.searchParams.get(CHAT_ID_PARAM);

    if (rawChatId === null) {
      return null;
    }

    const chatId = rawChatId.trim();
    url.searchParams.delete(CHAT_ID_PARAM);

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname || "/"}${url.search}${url.hash}`
    );

    return UUID_PATTERN.test(chatId) ? chatId : null;
  } catch {
    return null;
  }
}
