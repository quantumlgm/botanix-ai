import { apiClient } from "./client";
import { API_BASE_URL } from "./config";
import {
  isChatCreateResponse,
  isChatItem,
  isChatMessageResponse,
  isPlantIdentificationResult,
  isUserProfile,
} from "./types";
import type {
  UserProfile,
  ChatItem,
  ChatCreateResponse,
  ChatMessageResponse,
  PlantIdentificationResult,
} from "./types";

export async function getProfile(): Promise<UserProfile> {
  const response = await apiClient.get<unknown>("/users/me");
  if (!isUserProfile(response.data)) {
    throw new Error("Сервер вернул некорректный профиль пользователя");
  }
  return response.data;
}

export async function getChats(): Promise<ChatItem[]> {
  const response = await apiClient.get<unknown>("/chats");
  if (!Array.isArray(response.data) || !response.data.every(isChatItem)) {
    throw new Error("Сервер вернул некорректный список диалогов");
  }
  return response.data;
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiClient.delete(`/chats/${encodeURIComponent(chatId)}`);
}

export async function createChat(message: string): Promise<ChatCreateResponse> {
  const response = await apiClient.post<unknown>("/chats", {
    message,
  });
  if (!isChatCreateResponse(response.data)) {
    throw new Error("Сервер вернул некорректный ответ при создании диалога");
  }
  return response.data;
}

export async function getChatMessages(
  chatId: string
): Promise<ChatMessageResponse[]> {
  const response = await apiClient.get<unknown>(
    `/chats/${encodeURIComponent(chatId)}/messages`
  );
  if (
    !Array.isArray(response.data) ||
    !response.data.every(isChatMessageResponse)
  ) {
    throw new Error("Сервер вернул некорректную историю сообщений");
  }
  return response.data;
}

export async function streamChatMessage(
  chatId: string,
  message: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const initData = window.Telegram?.WebApp?.initData || "";

  const response = await fetch(
    `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = errorBody;
    try {
      const parsed: unknown = JSON.parse(errorBody);
      if (
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof parsed.detail === "string"
      ) {
        detail = parsed.detail;
      }
    } catch {
      // Non-JSON error bodies are surfaced as plain text.
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const emitPayload = (payload: string): boolean => {
    if (payload === "[DONE]") {
      return true;
    }

    onChunk(payload || "\n");
    return false;
  };

  const emitLine = (rawLine: string): boolean => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) return false;

    if (line.startsWith("data:")) {
      const payload = line.slice(5);
      return emitPayload(payload.startsWith(" ") ? payload.slice(1) : payload);
    }

    onChunk(line);
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (emitLine(line)) {
          await reader.cancel();
          return;
        }
      }
    }

    if (buffer.trim()) {
      emitLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function identifyPlant(file: File): Promise<PlantIdentificationResult> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await apiClient.post<unknown>(
    "/plants/identify",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  if (!isPlantIdentificationResult(response.data)) {
    throw new Error("Сервер вернул некорректный результат распознавания");
  }
  return response.data;
}