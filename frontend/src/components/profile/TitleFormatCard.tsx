import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fmtDay, isToday } from "@/lib/date";
import {
  aliasFromHow,
  deriveTokens,
  patternFromTokens,
  setTokenType,
  type Compiled,
  type PreviewResult,
  type Token,
  type TokenType,
} from "@/lib/patterns";
import { cn } from "@/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  MousePointerClick,
  Pencil,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SettingsCard } from "./SettingsCard";

const MAX_EXAMPLES = 300;

const TYPE_LABELS: Record<TokenType, string> = {
  text: "",
  home: "Home",
  away: "Away",
  time: "Time",
  n: "Number",
  league: "League",
};
const PICKER: TokenType[] = ["text", "home", "away", "time", "n"];

const CHIP_STYLES: Record<string, string> = {
  text: "border-(--color-border) bg-transparent text-(--color-text-secondary)",
  home: "border-(--color-capture-home) bg-(--color-capture-home)/15 text-(--color-foreground)",
  away: "border-(--color-capture-away) bg-(--color-capture-away)/18 text-(--color-foreground)",
  other:
    "border-(--color-muted) bg-(--color-surface-raised) text-(--color-foreground)",
};
const CAPTION_STYLES: Record<string, string> = {
  home: "text-(--color-capture-home-text)",
  away: "text-(--color-capture-away-text)",
  other: "text-(--color-muted)",
};
const styleFor = (map: Record<string, string>, type: TokenType) =>
  map[type] ?? map.other;

type Props = {
  titles: string[];
  pattern: string;
  compiled: Compiled;
  onPatternChange: (pattern: string) => void;
  evaluate: (title: string) => PreviewResult;
};

function checkMessage(
  r: PreviewResult,
  pattern: string,
): { ok: boolean; text: string } {
  switch (r.kind) {
    case "matched": {
      const g = r.game;
      const via = aliasFromHow(r.homeHow) ?? aliasFromHow(r.awayHow);
      const when = isToday(g.game_time)
        ? "today's ESPN game"
        : `the ESPN game on ${fmtDay(g.game_time)}`;
      return {
        ok: true,
        text: `Lines up with ${when}: ${g.home_team} (home) vs ${g.away_team}${via ? `, via the alias “${via}”` : ""}.`,
      };
    }
    case "skipped":
      return {
        ok: false,
        text: `This example is skipped because it contains ${r.term}.`,
      };
    case "nofit":
      return {
        ok: false,
        text: pattern.trim()
          ? "The pattern doesn't fit this example. Check the parts marked as exact text."
          : "Click the parts of the title that change from game to game and tag them: Home, Away, Time and Number.",
      };
    case "noteam":
      return {
        ok: false,
        text: `No upcoming ESPN game has “${r.groups.home}” at home and “${r.groups.away}” away.${r.reversed ? " Home and Away may be reversed." : ""}`,
      };
    case "fit":
      return {
        ok: false,
        text: "Tag a Home and an Away so Matcharr can check teams against ESPN.",
      };
    case "error":
      return { ok: false, text: r.message };
  }
}

function pickDefaultExample(
  titles: string[],
  evaluate: (t: string) => PreviewResult,
): string {
  const kinds = titles.map((t) => evaluate(t).kind);
  const i =
    kinds.indexOf("matched") >= 0
      ? kinds.indexOf("matched")
      : kinds.findIndex((k) => k === "noteam" || k === "fit");
  return titles[Math.max(i, 0)] ?? "";
}

export function TitleFormatCard({
  titles,
  pattern,
  compiled,
  onPatternChange,
  evaluate,
}: Props) {
  const [example, setExample] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [edited, setEdited] = useState<{ key: string; tokens: Token[] } | null>(
    null,
  );

  // Pin an example once streams load; re-pick only if it leaves the pool.
  useEffect(() => {
    if (!titles.length) return;
    if (example === null || !titles.includes(example)) {
      setExample(pickDefaultExample(titles, evaluate));
      setSelected(null);
    }
  }, [titles]);

  const exampleTitle =
    example !== null && titles.includes(example) ? example : (titles[0] ?? "");
  const key = `${exampleTitle}\u0000${pattern}`;
  const tokens = useMemo(
    () =>
      edited?.key === key
        ? edited.tokens
        : deriveTokens(exampleTitle, compiled),
    [edited, key, exampleTitle, compiled],
  );
  const sel =
    selected !== null && selected < tokens.length
      ? selected
      : Math.max(
          tokens.findIndex((t) => t.type === "home"),
          0,
        );

  const options = useMemo(() => {
    const list = titles.slice(0, MAX_EXAMPLES);
    if (exampleTitle && !list.includes(exampleTitle))
      list.unshift(exampleTitle);
    return list;
  }, [titles, exampleTitle]);

  function retag(type: TokenType) {
    if (!tokens[sel] || tokens[sel].type === type) return;
    const next = setTokenType(tokens, sel, type);
    const p = patternFromTokens(next);
    setEdited({ key: `${exampleTitle}\u0000${p}`, tokens: next });
    onPatternChange(p);
  }

  const hasExamples = titles.length > 0;
  const showText = textMode || !hasExamples;
  const check = exampleTitle
    ? checkMessage(evaluate(exampleTitle), pattern)
    : null;
  const selToken = tokens[sel];

  return (
    <SettingsCard
      step={2}
      title="Title format"
      helper="Click a part of the title, then choose what it is."
      footer={
        <>
          <span className="min-w-0 flex-1 font-mono text-xs break-words whitespace-pre-wrap text-(--color-text-secondary)">
            {pattern || "No pattern yet"}
          </span>
          {hasExamples && (
            <button
              type="button"
              onClick={() => setTextMode(!textMode)}
              className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-xs font-medium text-(--color-foreground) transition-colors duration-150 hover:border-(--color-muted)"
            >
              {textMode ? (
                <MousePointerClick className="h-3 w-3" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
              {textMode ? "Back to visual" : "Edit as text"}
            </button>
          )}
        </>
      }
    >
      <div>
        <Label htmlFor="example-stream">Example stream</Label>
        <Select
          id="example-stream"
          mono
          value={exampleTitle}
          disabled={!hasExamples}
          onChange={(e) => {
            setExample(e.target.value);
            setSelected(null);
            setTextMode(false);
          }}
        >
          {!hasExamples && (
            <option value="">No streams in this pool yet</option>
          )}
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      {showText ? (
        <div>
          <Label htmlFor="pattern-text">Pattern text</Label>
          <Input
            id="pattern-text"
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            spellCheck={false}
            aria-invalid={!compiled.ok}
            placeholder="e.g. MLB {n} | {away} x {home} start:{time}"
            className="font-mono text-xs"
          />
          <p className="mt-1.5 text-xs text-(--color-muted)">
            Placeholders:{" "}
            <span className="font-mono text-(--color-foreground)">
              {"{home} {away} {time} {n}"}
            </span>
            {!hasExamples &&
              ". No streams to use as an example yet, so adjust the stream filters or type the pattern."}
          </p>
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap items-end gap-x-1 gap-y-1.5"
            role="listbox"
            aria-label="Title parts"
          >
            {tokens.map((t, i) => (
              <button
                key={`${i}-${t.text}`}
                type="button"
                role="option"
                aria-selected={i === sel}
                onClick={() => setSelected(i)}
                className="flex cursor-pointer flex-col items-start gap-[3px]"
                style={{ marginRight: t.gap.length > 1 ? 8 : 0 }}
              >
                <span
                  className={cn(
                    "h-[11px] pl-0.5 text-[9px] leading-[11px] font-semibold tracking-[.08em] uppercase",
                    styleFor(CAPTION_STYLES, t.type),
                  )}
                >
                  {TYPE_LABELS[t.type]}
                </span>
                <span
                  className={cn(
                    "rounded-(--radius-sm) border px-2 py-[5px] font-mono text-[13px] whitespace-pre transition-colors duration-150",
                    styleFor(CHIP_STYLES, t.type),
                    i === sel &&
                      "border-(--color-accent) ring-2 ring-(--color-accent)/30",
                  )}
                >
                  {t.text}
                </span>
              </button>
            ))}
          </div>
          {selToken && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-(--radius-md) bg-(--color-surface-raised) px-3 py-2.5">
              <span className="text-xs text-(--color-muted)">
                Selected{" "}
                <span className="font-mono whitespace-pre text-(--color-foreground)">
                  “{selToken.text}”
                </span>{" "}
                is
              </span>
              <div
                role="radiogroup"
                aria-label="Part type"
                className="flex flex-wrap gap-1 rounded-(--radius-md) bg-(--color-background) p-[3px]"
              >
                {PICKER.map((ty) => {
                  const active = selToken.type === ty;
                  return (
                    <button
                      key={ty}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => retag(ty)}
                      className={cn(
                        "cursor-pointer rounded-(--radius-sm) px-2.5 py-[5px] text-xs font-medium transition-colors duration-150",
                        active
                          ? cn(
                              "bg-(--color-surface-raised)",
                              ty === "home"
                                ? "text-(--color-capture-home-text)"
                                : ty === "away"
                                  ? "text-(--color-capture-away-text)"
                                  : "text-(--color-foreground)",
                            )
                          : "text-(--color-muted) hover:text-(--color-foreground)",
                      )}
                    >
                      {ty === "text" ? "Exact text" : TYPE_LABELS[ty]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {check && (
        <div className="flex items-start gap-2 text-xs leading-normal text-(--color-foreground)">
          {check.ok ? (
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-(--color-success)" />
          ) : (
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-(--color-warning)" />
          )}
          <span>{check.text}</span>
        </div>
      )}
    </SettingsCard>
  );
}
