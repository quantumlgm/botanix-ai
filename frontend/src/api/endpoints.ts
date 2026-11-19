import {
  apiClient,
  CHAT_CREATE_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
} from "./client";
import { API_BASE_URL } from "./config";
import {
  ApiError,
  extractDetailMessage,
  getResponseErrorMessage,
} from "./errors";
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

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StreamChatOptions extends RequestOptions {
  idleTimeoutMs?: number;
}

export interface IdentifyPlantOptions extends RequestOptions {
  question?: string;
}

const SSE_IDLE_TIMEOUT_MS = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function decodeSsePayload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) return payload;

  const firstChar = trimmed[0];
  if (firstChar !== '"' && firstChar !== "{" && firstChar !== "[") {
    return payload;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (isRecord(parsed)) {
      if (typeof parsed.token === "string") return parsed.token;
      if (typeof parsed.content === "string") return parsed.content;
      if (typeof parsed.delta === "string") return parsed.delta;
    }
  } catch {
  }

  return payload;
}

function getStreamErrorMessage(payload: string): string {
  const detail = extractDetailMessage(parseJson(payload));
  return detail ?? "Не удалось получить ответ. Попробуйте ещё раз.";
}

export async function getProfile(
  options: RequestOptions = {}
): Promise<UserProfile> {
  const response = await apiClient.get<unknown>("/users/me", {
    signal: options.signal,
  });
  if (!isUserProfile(response.data)) {
    throw new Error("Server returned an invalid user profile");
  }
  return response.data;
}

export async function getChats(
  options: RequestOptions = {}
): Promise<ChatItem[]> {
  const response = await apiClient.get<unknown>("/chats", {
    signal: options.signal,
  });
  if (!Array.isArray(response.data) || !response.data.every(isChatItem)) {
    throw new Error("Server returned an invalid chats list");
  }
  return response.data;
}

export async function deleteChat(
  chatId: string,
  options: RequestOptions = {}
): Promise<void> {
  await apiClient.delete(`/chats/${encodeURIComponent(chatId)}`, {
    signal: options.signal,
  });
}

export async function createChat(
  message: string,
  options: RequestOptions = {}
): Promise<ChatCreateResponse> {
  const response = await apiClient.post<unknown>(
    "/chats",
    { message },
    {
      signal: options.signal,
      timeout: CHAT_CREATE_TIMEOUT_MS,
    }
  );
  if (!isChatCreateResponse(response.data)) {
    throw new Error("Server returned an invalid chat creation response");
  }
  return response.data;
}

export async function getChatMessages(
  chatId: string,
  options: RequestOptions = {}
): Promise<ChatMessageResponse[]> {
  const response = await apiClient.get<unknown>(
    `/chats/${encodeURIComponent(chatId)}/messages`,
    { signal: options.signal }
  );
  if (
    !Array.isArray(response.data) ||
    !response.data.every(isChatMessageResponse)
  ) {
    throw new Error("Server returned invalid message history");
  }
  return response.data;
}

export async function streamChatMessage(
  chatId: string,
  message: string,
  onChunk: (chunk: string) => void,
  options: StreamChatOptions = {}
): Promise<void> {
  const { signal, idleTimeoutMs = SSE_IDLE_TIMEOUT_MS } = options;
  const initData = window.Telegram?.WebApp?.initData || "";
  const controller = new AbortController();
  let idleTimedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const abortFromSignal = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      abortFromSignal();
    } else {
      signal.addEventListener("abort", abortFromSignal, { once: true });
    }
  }

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    if (idleTimeoutMs > 0) {
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        controller.abort();
      }, idleTimeoutMs);
    }
  };

  const createTimeoutError = () =>
    new ApiError("Сервер слишком долго не отвечает. Попробуйте ещё раз.", {
      code: "TIMEOUT",
    });

  try {
    armIdleTimer();

    const response = await fetch(
      `${API_BASE_URL}/chats/${encodeURIComponent(chatId)}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": initData,
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new ApiError(
        getResponseErrorMessage(
          response.status,
          parseJson(bodyText),
          "Не удалось отправить сообщение. Попробуйте ещё раз."
        ),
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("text/event-stream")) {
      throw new ApiError(
        "Сервер вернул неожиданный ответ. Попробуйте ещё раз.",
        { status: response.status }
      );
    }

    reader = response.body?.getReader() ?? null;
    if (!reader) {
      throw new ApiError("Браузер не поддерживает потоковый ответ.", {
        code: "STREAM_UNSUPPORTED",
      });
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventType = "";
    let dataLines: string[] = [];
    let eventLines: string[] = [];
    let hasLegacyLine = false;

    const dispatchEvent = (): boolean => {
      if (eventLines.length === 0 && dataLines.length === 0) {
        eventType = "";
        return false;
      }

      const type = eventType;
      const lines = eventLines;
      const payloadLines = dataLines;
      const isLegacy = hasLegacyLine;

      eventType = "";
      dataLines = [];
      eventLines = [];
      hasLegacyLine = false;

      if (isLegacy) {
        const text = lines
          .map((line) => {
            if (!line.startsWith("data:")) return line;
            const value = line.slice(5);
            return value.startsWith(" ") ? value.slice(1) : value;
          })
          .join("\n");

        if (text) onChunk(text);
        return false;
      }

      const payload = payloadLines.join("\n");
      if (payloadLines.length === 0) return false;

      if (type === "error") {
        throw new ApiError(getStreamErrorMessage(payload), {
          code: "STREAM_ERROR",
        });
      }

      if (payload === "") {
        onChunk("\n");
        return false;
      }

      const chunk = decodeSsePayload(payload);
      if (chunk === "[DONE]") return true;
      if (chunk) onChunk(chunk);
      return false;
    };

    const handleLine = (rawLine: string): boolean => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (!line) return dispatchEvent();

      eventLines.push(line);
      if (line.startsWith(":")) return false;

      const colonIndex = line.indexOf(":");
      const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
      let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
      if (value.startsWith(" ")) value = value.slice(1);

      if (field === "data") {
        dataLines.push(value);
        return false;
      }
      if (field === "event") {
        eventType = value;
        return false;
      }
      if (field === "id" || field === "retry") {
        return false;
      }

      hasLegacyLine = true;
      return false;
    };

    let streamDone = false;

    while (!streamDone) {
      armIdleTimer();
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (handleLine(line)) {
          streamDone = true;
          break;
        }

        newlineIndex = buffer.indexOf("\n");
      }
    }

    if (!streamDone) {
      if (buffer) {
        streamDone = handleLine(buffer);
        buffer = "";
      }
      if (!streamDone) {
        streamDone = dispatchEvent();
      }
    }

    if (streamDone) {
      clearIdleTimer();
      try {
        await reader.cancel();
      } catch {
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      if (idleTimedOut) throw createTimeoutError();
      throw error;
    }
    throw error;
  } finally {
    clearIdleTimer();
    signal?.removeEventListener("abort", abortFromSignal);

    if (reader) {
      try {
        await reader.cancel();
      } catch {
      }
      try {
        reader.releaseLock();
      } catch {
      }
    }
  }
}

export async function identifyPlant(
  file: File,
  options: IdentifyPlantOptions = {}
): Promise<PlantIdentificationResult> {
  const formData = new FormData();
  formData.append("image", file);

  const question = options.question?.trim();
  if (question) {
    formData.append("question", question);
  }

  const response = await apiClient.post<unknown>("/plants/identify", formData, {
    signal: options.signal,
    timeout: UPLOAD_TIMEOUT_MS,
  });
  if (!isPlantIdentificationResult(response.data)) {
    throw new Error("Server returned an invalid identification result");
  }
  return response.data;
}
