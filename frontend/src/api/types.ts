export interface UserProfile {
  id: string;
  telegram_id: number;
  first_name: string;
  username: string | null;
  created_at: string;
}

export interface ChatItem {
  id: string;
  title: string;
  plant_context: string | null;
  created_at: string;
}

export interface ChatMessageResponse {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCreateResponse {
  chat_id: string;
  reply: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PlantIdentificationResult {
  chat_id: string;
  scientific_name: string;
  family_name: string;
  common_names: string[];
  confidence: number;
  reply: string;
}

export type Screen = 'home' | 'identify' | 'chat';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isUserProfile(value: unknown): value is UserProfile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.telegram_id === "number" &&
    typeof value.first_name === "string" &&
    (typeof value.username === "string" || value.username === null) &&
    typeof value.created_at === "string"
  );
}

export function isChatItem(value: unknown): value is ChatItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (typeof value.plant_context === "string" || value.plant_context === null) &&
    typeof value.created_at === "string"
  );
}

export function isChatMessageResponse(
  value: unknown
): value is ChatMessageResponse {
  return (
    isRecord(value) &&
    (value.role === "user" ||
      value.role === "assistant" ||
      value.role === "system") &&
    typeof value.content === "string"
  );
}

export function isChatCreateResponse(
  value: unknown
): value is ChatCreateResponse {
  return (
    isRecord(value) &&
    typeof value.chat_id === "string" &&
    typeof value.reply === "string"
  );
}

export function isPlantIdentificationResult(
  value: unknown
): value is PlantIdentificationResult {
  return (
    isRecord(value) &&
    typeof value.chat_id === "string" &&
    typeof value.scientific_name === "string" &&
    typeof value.family_name === "string" &&
    Array.isArray(value.common_names) &&
    value.common_names.every((name) => typeof name === "string") &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    typeof value.reply === "string"
  );
}