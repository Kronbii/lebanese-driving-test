/** "YYYY-MM-DD" for <input type="date"> from an ISO date or datetime. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return localParts(date).slice(0, 10);
}

/** "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">. */
export function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T09:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  return localParts(date);
}

/** Local datetime input value -> ISO string (or null when empty). */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localParts(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Whole days from today until the given date (negative when in the past). */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(isDateOnly(value) ? `${value}T00:00` : value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export const DATE_ONLY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
export const DATE_LONG: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
export const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
};

/** Formats a date-only value without shifting it through UTC. */
export function asDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return isDateOnly(value) ? `${value}T12:00` : value;
}
