import type { Span } from "@/lib/types";
import { cn } from "@/lib/utils";

const CAPTURE_STYLES: Record<string, string> = {
  home: "bg-(--color-capture-home)/18 text-(--color-capture-home-text)",
  away: "bg-(--color-capture-away)/20 text-(--color-capture-away-text)",
};
const OTHER_CAPTURE = "bg-(--color-muted)/22 text-(--color-foreground)";

type Props = {
  title: string;
  spans?: Span[];
  /** Fade literal text further, e.g. for skipped or non-fitting titles. */
  dim?: boolean;
  className?: string;
};

/** A stream title in mono with pattern captures highlighted. */
export function HighlightedTitle({ title, spans = [], dim, className }: Props) {
  const t = title.trim();
  const parts: { text: string; field?: string }[] = [];
  let pos = 0;
  for (const [a, b, f] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (a < pos) continue;
    if (a > pos) parts.push({ text: t.slice(pos, a) });
    parts.push({ text: t.slice(a, b), field: f });
    pos = b;
  }
  if (pos < t.length) parts.push({ text: t.slice(pos) });

  return (
    <div
      className={cn(
        "font-mono text-xs leading-[1.6] break-words whitespace-pre-wrap",
        className,
      )}
    >
      {parts.map((p, i) =>
        p.field ? (
          <span
            key={i}
            className={cn(
              "rounded-[3px]",
              CAPTURE_STYLES[p.field] ?? OTHER_CAPTURE,
            )}
          >
            {p.text}
          </span>
        ) : (
          <span
            key={i}
            className={dim ? "text-(--color-muted)/70" : "text-(--color-muted)"}
          >
            {p.text}
          </span>
        ),
      )}
    </div>
  );
}
