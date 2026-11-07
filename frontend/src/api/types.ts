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

export interface ChatCreateResponse {
  chat_id: string;
  reply: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface PlantIdentificationResult {
  scientific_name: string;
  common_names: string[];
  confidence: number;
  description?: string;
  chat_id?: string;
}

export type Screen = 'home' | 'identify' | 'chat';