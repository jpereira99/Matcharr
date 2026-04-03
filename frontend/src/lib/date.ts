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

/** "Apr 3, 7:30:12 PM" – includes seconds, useful for scheduler precision. */
export function fmtDateTimeSec(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return dateTimeSecFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}
