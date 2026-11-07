import { apiClient } from "./client";
import type {
  UserProfile,
  ChatItem,
  ChatCreateResponse,
  ChatMessage,
  PlantIdentificationResult,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/users/me");
  return response.data;
}

export async function getChats(): Promise<ChatItem[]> {
  const response = await apiClient.get<ChatItem[]>("/chats");
  return response.data;
}

export async function deleteChat(chatId: string): Promise<void> {
  await apiClient.delete(`/chats/${chatId}`);
}

export async function createChat(message: string): Promise<ChatCreateResponse> {
  const response = await apiClient.post<ChatCreateResponse>("/chats", {
    message,
  });
  return response.data;
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  const response = await apiClient.get<ChatMessage[]>(`/chats/${chatId}/messages`);
  return response.data;
}

export async function streamChatMessage(
  chatId: string,
  message: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const initData = window.Telegram?.WebApp?.initData || "";

  const response = await fetch(`${API_BASE_URL}/chats/${chatId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          if (typeof parsed === "string") {
            onChunk(parsed);
          } else if (parsed && typeof parsed.content === "string") {
            onChunk(parsed.content);
          } else if (parsed && typeof parsed.reply === "string") {
            onChunk(parsed.reply);
          }
        } catch {
          onChunk(payload);
        }
      } else {
        onChunk(trimmed);
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(5).trim();
      if (payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload);
          onChunk(typeof parsed === "string" ? parsed : parsed.content || parsed.reply || payload);
        } catch {
          onChunk(payload);
        }
      }
    } else {
      onChunk(trimmed);
    }
  }
}

export async function identifyPlant(file: File): Promise<PlantIdentificationResult> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await apiClient.post<PlantIdentificationResult>(
    "/plants/identify",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}