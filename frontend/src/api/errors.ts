import { isAxiosError } from "axios";

const NO_PLANT_FOUND_DETAIL =
  "Не удалось обнаружить растение на снимке. Пожалуйста, сфокусируйтесь на листе или цветке.";
const IDENTIFICATION_UNAVAILABLE_DETAIL =
  "Сервис распознавания временно недоступен. Попробуйте позже.";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
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

  return fallback;
}
