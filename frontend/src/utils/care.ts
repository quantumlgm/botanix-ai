import type { PlantCareInfo } from "../api/types";

export type CareTipKey =
  | "light"
  | "water"
  | "temperature"
  | "humidity"
  | "complexity"
  | "toxicity";

export interface CareTip {
  key: CareTipKey;
  label: string;
  value: string;
  tone?: "default" | "danger";
}

interface CareTopic {
  key: CareTipKey;
  label: string;
  pattern: RegExp;
}

const CARE_TOPICS: CareTopic[] = [
  {
    key: "light",
    label: "Освещение",
    pattern: /^(?:освещени\p{L}*|свет\p{L}*)$/iu,
  },
  {
    key: "water",
    label: "Полив",
    pattern: /^(?:полив\p{L}*|поливать|режим полива)$/iu,
  },
  {
    key: "temperature",
    label: "Температура",
    pattern: /^(?:температур\p{L}*|тепловой режим)$/iu,
  },
];

function stripFormatting(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabel(value: string): string {
  return stripFormatting(value)
    .replace(/[.:;]+$/, "")
    .trim()
    .toLowerCase();
}

function findTopic(label: string): CareTopic | null {
  const normalized = normalizeLabel(label);

  if (!normalized) {
    return null;
  }

  return (
    CARE_TOPICS.find((topic) => topic.pattern.test(normalized)) ?? null
  );
}

function cleanValue(value: string): string {
  return stripFormatting(value)
    .replace(/^[\s:—–-]+/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[;:,.\s]+$/, "")
    .trim();
}

function shortenValue(value: string): string {
  const firstSentence = value.split(/(?<=[.!?])\s+/)[0] ?? value;
  const candidate =
    firstSentence.length >= 12 && firstSentence.length <= 96
      ? firstSentence
      : value;

  if (candidate.length <= 96) {
    return candidate;
  }

  const truncated = candidate.slice(0, 92).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safeCut =
    lastSpace >= 40 ? truncated.slice(0, lastSpace) : truncated;

  return `${safeCut.replace(/[,;:—–-]+$/, "").trimEnd()}…`;
}

function compactValue(key: CareTipKey, value: string): string {
  if (key === "temperature") {
    const range = value.match(
      /[+\-−]?\d{1,2}(?:[.,]\d+)?\s*(?:[–—-]|…)\s*[+\-−]?\d{1,2}(?:[.,]\d+)?\s*°\s*[CF]/iu
    );

    if (range) {
      return range[0].replace(/\s+/g, " ");
    }
  }

  if (key === "water") {
    const frequency = value.match(
      /(?:раз|каждые)\s+в?\s*\d+\s*[–—-]\s*\d+\s*(?:дн\p{L}*|недел\p{L}*)/iu
    );

    if (frequency) {
      return frequency[0].replace(/\s+/g, " ");
    }
  }

  return shortenValue(value).replace(/[.!?]+$/, "");
}

function parseTableRow(line: string): { key: CareTipKey; value: string } | null {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  if (cells.length < 2 || /^:?-{2,}/.test(cells[0])) {
    return null;
  }

  const topic = findTopic(cells[0]);
  const value = cleanValue(cells[1]);

  if (!topic || !value) {
    return null;
  }

  return { key: topic.key, value };
}

function parseCareLine(
  line: string
): { key: CareTipKey; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("|")) {
    return parseTableRow(trimmed);
  }

  const cleaned = trimmed
    .replace(/^>\s*/, "")
    .replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "");

  const match = cleaned.match(
    /^(?:#{1,6}\s*)?(.{2,42}?)\s*(?:\*\*|__)?\s*[:.!—–]\s*(.+)$/
  );

  if (!match) {
    return null;
  }

  const topic = findTopic(match[1]);
  const value = cleanValue(match[2]);

  if (!topic || !value) {
    return null;
  }

  return { key: topic.key, value };
}

export function extractCareTips(reply: string): CareTip[] {
  const values = new Map<CareTipKey, string>();

  for (const line of reply.split(/\r?\n/)) {
    const parsed = parseCareLine(line);

    if (!parsed || values.has(parsed.key)) {
      continue;
    }

    const value = compactValue(parsed.key, parsed.value);

    if (value) {
      values.set(parsed.key, value);
    }

    if (values.size === CARE_TOPICS.length) {
      break;
    }
  }

  return CARE_TOPICS.flatMap((topic) => {
    const value = values.get(topic.key);

    return value ? [{ key: topic.key, label: topic.label, value }] : [];
  });
}

export function buildCareTipsFromData(data: PlantCareInfo): CareTip[] {
  const complexity = data.care_complexity
    ? `${data.care_complexity} · ${data.complexity_rate}/5`
    : `${data.complexity_rate}/5`;

  const tips: CareTip[] = [
    { key: "light", label: "Освещение", value: data.light },
    { key: "water", label: "Полив", value: data.watering },
    { key: "temperature", label: "Температура", value: data.temperature },
    { key: "humidity", label: "Влажность", value: data.humidity },
    { key: "complexity", label: "Сложность ухода", value: complexity },
    {
      key: "toxicity",
      label: "Токсичность",
      value: data.toxicity_note,
      tone: data.is_toxic ? "danger" : "default",
    },
  ];

  return tips.filter((tip) => tip.value.trim().length > 0);
}
