import axios, { isAxiosError } from "axios";

const NO_PLANT_FOUND_DETAIL =
  "Не удалось обнаружить растение на снимке. Пожалуйста, сфокусируйтесь на листе или цветке.";
const IDENTIFICATION_UNAVAILABLE_DETAIL =
  "Сервис распознавания временно недоступен. Попробуйте позже.";

const OFFLINE_MESSAGE =
  "Нет подключения к интернету. Проверьте сеть и попробуйте снова.";
const NETWORK_MESSAGE =
  "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.";
const TIMEOUT_MESSAGE = "Сервер не ответил вовремя. Попробуйте ещё раз.";
const DEFAULT_FALLBACK = "Не удалось выполнить запрос. Попробуйте ещё раз.";

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    options: { status?: number; code?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAbortError(error: unknown): boolean {
  if (axios.isCancel(error)) return true;

  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "CanceledError")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

function translateValidationMessage(message: string): string {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) return "";
  if (lower === "field required") return "обязательное поле не заполнено";
  if (lower.startsWith("string should have at most")) {
    return "слишком длинное значение";
  }
  if (lower.startsWith("string should have at least")) {
    return "слишком короткое значение";
  }
  if (lower.startsWith("input should be") || lower.startsWith("value is not")) {
    return "некорректное значение";
  }

  return isReadableDetail(trimmed) ? trimmed : "";
}

function isReadableDetail(value: string): boolean {
  const trimmed = value.trim();
  return (
    Boolean(trimmed) &&
    !trimmed.startsWith("<") &&
    trimmed.length <= 300 &&
    CYRILLIC_PATTERN.test(trimmed)
  );
}

export function extractDetailMessage(data: unknown): string | null {
  if (typeof data === "string") {
    return isReadableDetail(data) ? data.trim() : null;
  }

  if (!isRecord(data)) return null;

  const detail = data.detail ?? data.message;

  if (typeof detail === "string") {
    return isReadableDetail(detail) ? detail.trim() : null;
  }

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (typeof item === "string") {
        return isReadableDetail(item) ? [item.trim()] : [];
      }
      if (isRecord(item) && typeof item.msg === "string") {
        const translated = translateValidationMessage(item.msg);
        return translated ? [translated] : [];
      }
      return [];
    });

    const uniqueMessages = [...new Set(messages)];
    if (uniqueMessages.length > 0) {
      return uniqueMessages.join("; ");
    }
  }

  return null;
}

export function getResponseErrorMessage(
  status: number,
  data: unknown,
  fallback: string = DEFAULT_FALLBACK
): string {
  const detail = extractDetailMessage(data);

  switch (status) {
    case 401:
      return "Не удалось подтвердить вход через Telegram. Откройте приложение заново.";
    case 403:
      return "Нет доступа к этому действию.";
    case 404:
      return "Запрошенные данные не найдены.";
    case 408:
      return TIMEOUT_MESSAGE;
    case 413:
      return "Файл слишком большой. Максимальный размер — 5 МБ.";
    case 415:
      return "Этот формат файла не поддерживается. Выберите JPG, PNG или WebP.";
    case 422:
      if (!detail) {
        return "Сервер не принял данные запроса. Проверьте их и попробуйте снова.";
      }
      return `Проверьте данные запроса: ${
        detail.endsWith(".") ? detail.slice(0, -1) : detail
      }.`;
    case 429:
      return "Слишком много запросов. Подождите немного и попробуйте снова.";
    default:
      if (status >= 500) {
        return "Сервер временно недоступен. Попробуйте позже.";
      }
      return detail ?? fallback;
  }
}

function isTimeoutError(error: unknown): boolean {
  if (isApiError(error)) return error.code === "TIMEOUT";

  return (
    isAxiosError(error) &&
    (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
  );
}

function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return !error.response && error.code === "ERR_NETWORK";
  }

  if (!(error instanceof TypeError)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAbortError(error)) return "";

  if (isApiError(error)) return error.message;

  if (isTimeoutError(error)) return TIMEOUT_MESSAGE;

  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status) {
      return getResponseErrorMessage(status, error.response?.data, fallback);
    }
    return typeof navigator !== "undefined" && navigator.onLine === false
      ? OFFLINE_MESSAGE
      : NETWORK_MESSAGE;
  }

  if (isNetworkError(error)) {
    return typeof navigator !== "undefined" && navigator.onLine === false
      ? OFFLINE_MESSAGE
      : NETWORK_MESSAGE;
  }

  return fallback;
}

export function getPlantIdentificationErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (
      detail === NO_PLANT_FOUND_DETAIL ||
      detail === IDENTIFICATION_UNAVAILABLE_DETAIL
    ) {
      return detail;
    }
  }

  return getErrorMessage(error, fallback);
}
