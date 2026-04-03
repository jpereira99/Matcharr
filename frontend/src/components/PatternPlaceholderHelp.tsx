/** Shared copy: how stream title patterns relate to ESPN and Dispatcharr. */

/** Placeholders accepted by the backend compiler — order used by the pattern builder shelf. */
export const PATTERN_PLACEHOLDER_TOKENS = ["{n}", "{away}", "{home}", "{time}", "{league}"] as const;

export function PatternPlaceholderTable() {
  return (
    <dl className="mt-2 space-y-2 text-xs text-[var(--color-muted)]">
      <div className="grid gap-1 border-b border-white/5 pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-[var(--color-foreground)]">{"{away}"}</code>
        </dt>
        <dd>Away team text as it appears in the stream title (matched against ESPN + aliases).</dd>
      </div>
      <div className="grid gap-1 border-b border-white/5 pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-[var(--color-foreground)]">{"{home}"}</code>
        </dt>
        <dd>Home team text in the title.</dd>
      </div>
      <div className="grid gap-1 border-b border-white/5 pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-[var(--color-foreground)]">{"{n}"}</code>
        </dt>
        <dd>Numbers only (e.g. stream index).</dd>
      </div>
      <div className="grid gap-1 border-b border-white/5 pb-2 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-[var(--color-foreground)]">{"{time}"}</code>
        </dt>
        <dd>Any remaining text (often clock or schedule tail). Not used for team matching.</dd>
      </div>
      <div className="grid gap-1 md:grid-cols-[7rem_1fr]">
        <dt>
          <code className="text-[var(--color-foreground)]">{"{league}"}</code>
        </dt>
        <dd>Extra text capture if your titles include a league label.</dd>
      </div>
      <p className="pt-2 text-[var(--color-muted)]">
        Use literal braces in the template as <code className="font-mono text-[var(--color-foreground)]">{"{{"}</code> and{" "}
        <code className="font-mono text-[var(--color-foreground)]">{"}}"}</code>. Everything else is matched exactly
        (spacing, <code className="font-mono">vs</code>, <code className="font-mono">x</code>, etc.).
      </p>
    </dl>
  );
}

export function AliasesFieldHelp() {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
      <strong className="text-[var(--color-foreground)]">Optional.</strong> The dropdown sets the{" "}
      <strong className="text-[var(--color-foreground)]">official ESPN name</strong> used for schedules (e.g. Minnesota
      Twins). Stream titles often use shorter names (e.g. Twins). The router fuzzy-matches names, but if titles still
      don’t line up, add comma-separated aliases that appear in Dispatcharr titles for this team.
    </p>
  );
}

export function LeagueProfileSetupIntro() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-[var(--color-muted)]">
      <p className="font-medium text-[var(--color-foreground)]">How this fits together</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          <strong className="text-[var(--color-foreground)]">Stream name filter</strong> narrows which Dispatcharr streams
          are searched (same idea as typing in Dispatcharr’s stream list).
        </li>
        <li>
          <strong className="text-[var(--color-foreground)]">Pattern</strong> must split each stream title into{" "}
          <code className="font-mono text-xs">{"{away}"}</code> and <code className="font-mono text-xs">{"{home}"}</code>{" "}
          so they line up with the wording your provider uses (e.g. <code className="font-mono text-xs">vs</code> vs{" "}
          <code className="font-mono text-xs">x</code>).
        </li>
        <li>
          <strong className="text-[var(--color-foreground)]">ESPN sport / league</strong> control the schedule. On{" "}
          <span className="text-[var(--color-foreground)]">Team channels</span>, each mapping uses the official ESPN team
          name from the dropdown; the router matches that to the schedule, then checks stream titles using the pattern.
        </li>
      </ol>
    </div>
  );
}
