import { cn } from "@/lib/utils";

const PILLS: Record<string, { label: string; className: string }> = {
  home: {
    label: "Home",
    className:
      "border-(--color-capture-home) bg-(--color-capture-home)/15 text-(--color-capture-home-text)",
  },
  away: {
    label: "Away",
    className:
      "border-(--color-capture-away) bg-(--color-capture-away)/18 text-(--color-capture-away-text)",
  },
  time: { label: "Time", className: "" },
  n: { label: "Number", className: "" },
  league: { label: "League", className: "" },
};
const OTHER_PILL =
  "border-(--color-muted) bg-(--color-surface) text-(--color-foreground)";

export function PatternPill({
  field,
  className,
}: {
  field: string;
  className?: string;
}) {
  const pill = PILLS[field];
  return (
    <span
      className={cn(
        "rounded-[4px] border px-1.5 py-px font-sans text-[10px] font-semibold",
        pill?.className || OTHER_PILL,
        className,
      )}
    >
      {pill?.label ?? field}
    </span>
  );
}

/** A league pattern as literal text and placeholder pills. */
export function PatternStrip({ pattern }: { pattern: string }) {
  const parts: { text: string; field?: string }[] = [];
  let last = 0;
  for (const m of pattern.matchAll(/\{\{|\}\}|\{(\w+)\}/g)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: pattern.slice(last, at) });
    if (m[1]) parts.push({ text: m[0], field: m[1] });
    else parts.push({ text: m[0][0] });
    last = at + m[0].length;
  }
  if (last < pattern.length) parts.push({ text: pattern.slice(last) });

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-[3px] gap-y-1 rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2.5 font-mono text-xs text-(--color-text-secondary)">
      {parts.length === 0 ? (
        <span className="font-sans text-(--color-muted)">
          No title format yet
        </span>
      ) : (
        parts.map((p, i) =>
          p.field ? (
            <PatternPill key={i} field={p.field} />
          ) : (
            <span key={i} className="whitespace-pre">
              {p.text}
            </span>
          ),
        )
      )}
    </div>
  );
}
