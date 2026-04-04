import {
  PATTERN_PLACEHOLDER_TOKENS,
  PatternPlaceholderTable,
} from "@/components/PatternPlaceholderHelp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { replaceSelectionWithPlaceholder } from "@/lib/patternBuilder";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  idSuffix?: string;
  compactHelp?: boolean;
};

export function StreamPatternField({
  value,
  onChange,
  idSuffix = "",
  compactHelp,
}: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const patternRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<{ start: number; end: number } | null>(null);
  const patternId = `stream-pattern-value${idSuffix}`;

  useLayoutEffect(() => {
    const el = patternRef.current;
    const p = pendingCaret.current;
    if (!el || !p) return;
    pendingCaret.current = null;
    el.setSelectionRange(p.start, p.end);
    el.focus();
  }, [value]);

  function applyPlaceholder(token: string) {
    setHint(null);
    const el = patternRef.current;
    if (!el) return;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;
    const out = replaceSelectionWithPlaceholder(value, selStart, selEnd, token);
    if (!out.ok) {
      setHint(out.message);
      return;
    }
    pendingCaret.current = { start: out.caret, end: out.caret };
    onChange(out.next);
    setHint(`Replaced selection with ${token}.`);
  }

  return (
    <div className="md:col-span-2">
      <div className="overflow-hidden rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)">
        <div className="p-4">
          <Label htmlFor={patternId}>Pattern</Label>
          <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">
            Paste a title from Dispatcharr, select the text to capture, then
            insert a token below.
          </p>
          <Input
            id={patternId}
            ref={patternRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onMouseUp={() => setHint(null)}
            onKeyUp={() => setHint(null)}
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. (Apple) (MLS) 003 | MLS: Salt Lake vs. Kansas City …"
            className="mt-2 font-mono text-xs"
          />
        </div>

        <div className="border-t border-(--color-border) bg-(--color-surface-raised) px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="shrink-0 text-[10px] font-medium tracking-wider text-(--color-muted) uppercase">
              Insert
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {PATTERN_PLACEHOLDER_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => applyPlaceholder(token)}
                  className={cn(
                    "cursor-pointer rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2 py-1 font-mono text-[11px] leading-none",
                    "text-(--color-accent) transition-colors",
                    "hover:border-(--color-accent)/30 hover:bg-(--color-accent)/5",
                  )}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>
          {hint && (
            <p
              className={cn(
                "mt-2 text-xs",
                hint.startsWith("Replaced")
                  ? "text-(--color-muted)"
                  : "text-(--color-warning)",
              )}
            >
              {hint}
            </p>
          )}
        </div>

        {!compactHelp && (
          <div className="border-t border-(--color-border) px-4 py-3">
            <p className="text-[10px] font-medium tracking-wider text-(--color-muted) uppercase">
              Example
            </p>
            <p className="mt-1.5 text-xs text-(--color-muted)">
              <code className="rounded-(--radius-sm) bg-(--color-surface-raised) px-1.5 py-0.5 font-mono text-[10px] break-all text-(--color-foreground) sm:text-[11px]">
                MLB {"{n}"} | {"{away}"} x {"{home}"} start:{"{time}"}
              </code>
            </p>
          </div>
        )}
        {compactHelp && (
          <div className="border-t border-(--color-border) px-4 py-3">
            <p className="text-xs text-(--color-muted)">
              Use{" "}
              <code className="font-mono text-(--color-foreground)">
                {"{away}"}
              </code>{" "}
              and{" "}
              <code className="font-mono text-(--color-foreground)">
                {"{home}"}
              </code>{" "}
              where team names appear.
            </p>
          </div>
        )}

        <details className="group border-t border-(--color-border)">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-xs font-medium text-(--color-foreground) transition hover:bg-(--color-surface-raised) [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-(--color-muted) transition-transform group-open:rotate-90"
              aria-hidden
            />
            Placeholder reference
          </summary>
          <div className="border-t border-(--color-border) bg-(--color-surface-raised) px-4 pt-1 pb-4">
            <PatternPlaceholderTable />
          </div>
        </details>
      </div>
    </div>
  );
}
