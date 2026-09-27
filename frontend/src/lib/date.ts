/**
 * Lightweight date formatting helpers.
 *
 * All functions accept an ISO-8601 string (UTC from the backend) and
 * format it in the browser's local timezone using `Intl.DateTimeFormat`.
 */

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateTimeSecFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

/** "Apr 3, 7:30 PM" – for game times and general timestamps. */
export function fmtDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return dateTimeFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, {
  month: "numeric",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

/** "Sat 9/26" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${weekdayFmt.format(d)} ${monthDayFmt.format(d)}`;
}

/** "7:30 PM" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return timeFmt.format(new Date(iso));
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** "just now", "4 min ago", "2 h ago" */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

/** "Apr 3, 7:30:12 PM" – includes seconds, useful for scheduler precision. */
export function fmtDateTimeSec(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return dateTimeSecFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}
