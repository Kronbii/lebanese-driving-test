import { isDateOnly } from "./dates";

interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO date ("YYYY-MM-DD" = all-day event) or ISO datetime. */
  start: string;
  durationMinutes?: number;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines to 75 octets as RFC 5545 requires (multi-byte safe). */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function compactDate(value: string): string {
  return value.replace(/-/g, "");
}

function nextDay(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function buildIcs(event: CalendarEvent): string | null {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LDT//Staff//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT"];
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${utcStamp(new Date())}`);
  if (isDateOnly(event.start)) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(event.start))}`);
  } else {
    const start = new Date(event.start);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
    lines.push(`DTSTART:${utcStamp(start)}`);
    lines.push(`DTEND:${utcStamp(end)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT12H", `DESCRIPTION:${escapeText(event.title)}`, "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadIcs(event: CalendarEvent, filename: string): boolean {
  const content = buildIcs(event);
  if (!content) return false;
  downloadText(content, filename, "text/calendar;charset=utf-8");
  return true;
}
