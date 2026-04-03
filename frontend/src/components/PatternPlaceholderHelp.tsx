export const PATTERN_PLACEHOLDER_TOKENS = ["{n}", "{away}", "{home}", "{time}", "{league}"] as const;

export function PatternPlaceholderTable() {
  return (
    <dl className="mt-2 space-y-2 text-xs text-(--color-muted)">
      <div className="grid gap-1 border-b border-(--color-border) pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-(--color-foreground)">{"{away}"}</code>
        </dt>
        <dd>Away team text as it appears in the stream title (matched against ESPN + aliases).</dd>
      </div>
      <div className="grid gap-1 border-b border-(--color-border) pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-(--color-foreground)">{"{home}"}</code>
        </dt>
        <dd>Home team text in the title.</dd>
      </div>
      <div className="grid gap-1 border-b border-(--color-border) pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-(--color-foreground)">{"{n}"}</code>
        </dt>
        <dd>Numbers only (e.g. stream index).</dd>
      </div>
      <div className="grid gap-1 border-b border-(--color-border) pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-(--color-foreground)">{"{time}"}</code>
        </dt>
        <dd>Any remaining text (often clock or schedule tail). Not used for team matching.</dd>
      </div>
      <div className="grid gap-1 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-(--color-foreground)">{"{league}"}</code>
        </dt>
        <dd>Extra text capture if your titles include a league label.</dd>
      </div>
      <p className="pt-2 text-(--color-muted)">
        Use literal braces in the template as <code className="font-mono text-(--color-foreground)">{"{{"}</code> and{" "}
        <code className="font-mono text-(--color-foreground)">{"}}"}</code>. Everything else is matched exactly.
      </p>
    </dl>
  );
}

export function AliasesFieldHelp() {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-(--color-muted)">
      <strong className="text-(--color-foreground)">Optional.</strong> The dropdown sets the{" "}
      <strong className="text-(--color-foreground)">official ESPN name</strong> used for schedules. Stream titles
      often use shorter names. The router fuzzy-matches, but add comma-separated aliases if titles still don't line up.
    </p>
  );
}

export function LeagueProfileSetupIntro() {
  return (
    <div className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface-raised)/50 p-4 text-sm leading-relaxed text-(--color-muted)">
      <p className="font-medium text-(--color-foreground)">How this fits together</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <strong className="text-(--color-foreground)">Stream name filter</strong> narrows which Dispatcharr streams
          are searched.
        </li>
        <li>
          <strong className="text-(--color-foreground)">Pattern</strong> must split each stream title into{" "}
          <code className="font-mono text-xs">{"{away}"}</code> and <code className="font-mono text-xs">{"{home}"}</code>{" "}
          so they line up with the wording your provider uses.
        </li>
        <li>
          <strong className="text-(--color-foreground)">ESPN sport / league</strong> control the schedule. On{" "}
          <span className="text-(--color-foreground)">Team Channels</span>, each mapping uses the official ESPN team
          name from the dropdown.
        </li>
      </ol>
    </div>
  );
}
