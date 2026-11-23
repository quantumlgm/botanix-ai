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
  image_urls?: string[];
}

export interface ChatCreateResponse {
  chat_id: string;
  reply: string;
}

export interface ChatImageUploadResponse {
  image_url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_urls: string[];
}

export interface PlantCareInfo {
  light: string;
  watering: string;
  temperature: string;
  humidity: string;
  care_complexity: string;
  complexity_rate: number;
  is_toxic: boolean;
  toxicity_note: string;
}

export interface PlantIdentificationResult {
  chat_id: string;
  scientific_name: string;
  family_name: string;
  common_names: string[];
  confidence: number;
  data?: PlantCareInfo | null;
  reply: string;
}

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
    typeof value.content === "string" &&
    (value.image_urls === undefined ||
      (Array.isArray(value.image_urls) &&
        value.image_urls.every(
          (url) => typeof url === "string" && url.length > 0
        )))
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

export function isChatImageUploadResponse(
  value: unknown
): value is ChatImageUploadResponse {
  return (
    isRecord(value) &&
    typeof value.image_url === "string" &&
    value.image_url.length > 0
  );
}

export function isPlantCareInfo(value: unknown): value is PlantCareInfo {
  return (
    isRecord(value) &&
    typeof value.light === "string" &&
    typeof value.watering === "string" &&
    typeof value.temperature === "string" &&
    typeof value.humidity === "string" &&
    typeof value.care_complexity === "string" &&
    typeof value.complexity_rate === "number" &&
    Number.isFinite(value.complexity_rate) &&
    value.complexity_rate >= 0 &&
    value.complexity_rate <= 5 &&
    typeof value.is_toxic === "boolean" &&
    typeof value.toxicity_note === "string"
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
    (value.data === undefined ||
      value.data === null ||
      isPlantCareInfo(value.data)) &&
    typeof value.reply === "string"
  );
}