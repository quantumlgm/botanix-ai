import { apiClient } from "./client";
import type {
  UserProfile,
  ChatItem,
  ChatCreateResponse,
  ChatMessage,
  PlantIdentificationResult,
} from "./types";

export async function getProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/users/me");
  return response.data;
}

export async function getChats(): Promise<ChatItem[]> {
  const response = await apiClient.get<ChatItem[]>("/chats");
  return response.data;
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

export async function sendMessage(chatId: string, message: string): Promise<{ reply: string }> {
  const response = await apiClient.post<{ reply: string }>(`/chats/${chatId}/messages`, {
    message,
  });
  return response.data;
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