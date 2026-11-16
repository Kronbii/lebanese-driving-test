/** Minimal iCalendar (.ics) generation for reminders — works offline, no server or push needed. */

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  /** e.g. "FREQ=DAILY" */
  rrule?: string;
  /** Minutes before start for an alarm. */
  alarmMinutes?: number;
  url?: string;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(events: IcsEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ldt//trainer//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(event.start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(event.title)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escape(event.description)}`);
    if (event.url) lines.push(`URL:${event.url}`);
    if (event.rrule) lines.push(`RRULE:${event.rrule}`);
    if (event.alarmMinutes !== undefined) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(event.title)}`,
        `TRIGGER:-PT${event.alarmMinutes}M`,
        "END:VALARM"
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadText(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadIcs(events: IcsEvent[], filename: string): void {
  downloadText(buildIcs(events), filename, "text/calendar;charset=utf-8");
}

/** Next occurrence of HH:MM local time (today if still ahead, else tomorrow). */
export function nextTimeOfDay(time: string, now = new Date()): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(now);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}
