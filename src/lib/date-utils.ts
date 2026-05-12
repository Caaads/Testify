type WallClockDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseWallClockDateTime(value: string | null | undefined): WallClockDateTimeParts | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(" ", "T");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
}

function formatWallClockParts(parts: WallClockDateTimeParts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function toDatetimeLocalValue(value: string | null | undefined): string {
  const parts = parseWallClockDateTime(value);
  if (!parts) {
    return "";
  }

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function toStoredWallClockValue(value: string | null | undefined): string {
  const parts = parseWallClockDateTime(value);
  if (!parts) {
    return "";
  }

  return formatWallClockParts(parts);
}

export function formatWallClockDateTime(value: string | null | undefined, locale?: string): string {
  const parts = parseWallClockDateTime(value);
  if (!parts) {
    return String(value ?? "").trim();
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatWallClockTime(value: string | null | undefined, locale?: string): string {
  const parts = parseWallClockDateTime(value);
  if (!parts) {
    return String(value ?? "").trim();
  }

  const date = new Date(Date.UTC(1970, 0, 1, parts.hour, parts.minute, parts.second));
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function getCurrentWallClockValue(): string {
  const now = new Date();
  return formatWallClockParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  });
}

export function wallClockDateToValue(date: Date): string {
  return formatWallClockParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  });
}
