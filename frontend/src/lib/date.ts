/**
 * Date formatting helpers.
 *
 * Inputs are ISO-8601 strings (UTC from the backend). Output uses the display
 * timezone from Settings (set once via `setDisplayTimeZone`), falling back to
 * the browser's zone.
 */

let displayTimeZone: string | undefined;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setDisplayTimeZone(tz: string | undefined) {
  const next = tz && isValidTimeZone(tz) ? tz : undefined;
  if (next === displayTimeZone) return;
  displayTimeZone = next;
  formatters.clear();
}

export function getDisplayTimeZone(): string {
  return displayTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function fmt(key: string, opts: Intl.DateTimeFormatOptions) {
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, {
      ...opts,
      timeZone: displayTimeZone,
    });
    formatters.set(key, f);
  }
  return f;
}

/** switch_log timestamps are UTC "YYYY-MM-DD HH:MM:SS" without a zone. */
export function parseUtc(s: string): Date {
  return new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`,
  );
}

/** "Apr 3, 7:30 PM" – for game times and general timestamps. */
export function fmtDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return fmt("dt", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "Apr 3, 7:30:12 PM" – includes seconds, useful for scheduler precision. */
export function fmtDateTimeSec(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return fmt("dts", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "Sat 9/26" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${fmt("wd", { weekday: "short" }).format(d)} ${fmt("md", { month: "numeric", day: "numeric" }).format(d)}`;
}

/** "7:30 PM" */
export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return fmt("t", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "2 PM" */
export function fmtHour(d: Date | number): string {
  return fmt("h", { hour: "numeric" }).format(new Date(d));
}

/** "Sun 1:00 PM" */
export function fmtWeekdayTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${fmt("wd", { weekday: "short" }).format(d)} ${fmtTime(d)}`;
}

/** Calendar day in the display timezone, as "YYYY-MM-DD". */
export function dayKey(d: string | Date): string {
  const parts = fmt("key", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(d));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isToday(iso: string | Date): boolean {
  return dayKey(iso) === dayKey(new Date());
}

/** "just now", "4 min ago", "2 h ago" */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

/** Offset of `tz` from UTC at `utcMs`, in ms. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Interpret a wall-clock time given as UTC fields in `tz`; returns real UTC ms. */
export function zonedToUtc(naiveUtcMs: number, tz: string): number {
  const guess = naiveUtcMs - tzOffsetMs(naiveUtcMs, tz);
  return naiveUtcMs - tzOffsetMs(guess, tz);
}

/** Midnight (display timezone) `daysAgo` days before today, as a Date. */
export function startOfDay(daysAgo = 0, from: Date = new Date()): Date {
  const [y, m, d] = dayKey(from).split("-").map(Number);
  return new Date(
    zonedToUtc(Date.UTC(y, m - 1, d - daysAgo), getDisplayTimeZone()),
  );
}
