/**
 * Client-side port of backend/app/services/patterns.py (+ the per-stream parts of
 * candidates.py) so the League Profile preview can re-evaluate on every edit.
 * Keep behaviour in sync with the Python implementation.
 */
import type { Span, StreamCheckGame } from "./types";

export const PLACEHOLDERS = {
  n: "(\\d+)",
  away: "(.+?)",
  home: "(.+?)",
  time: "(.+?)",
  league: "(.+?)",
} as const;

export type Field = keyof typeof PLACEHOLDERS;

export type Compiled =
  | { ok: true; re: RegExp; fields: Field[] }
  | { ok: false; error: string };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function literalRegex(text: string): string {
  return text.split(/\s+/).map(escapeRegex).join("\\s+");
}

export function compilePattern(pattern: string): Compiled {
  const src = pattern.trim();
  const fields: Field[] = [];
  let out = "";
  let literal = "";
  const flush = () => {
    if (literal) out += literalRegex(literal);
    literal = "";
  };
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "{{" || two === "}}") {
      literal += two[0];
      i += 2;
      continue;
    }
    if (src[i] === "{") {
      const j = src.indexOf("}", i + 1);
      if (j === -1) return { ok: false, error: "Unclosed '{' in pattern" };
      const name = src.slice(i + 1, j).trim();
      if (!(name in PLACEHOLDERS))
        return { ok: false, error: `Unknown placeholder '{${name}}'` };
      flush();
      fields.push(name as Field);
      out += PLACEHOLDERS[name as Field];
      i = j + 1;
      continue;
    }
    literal += src[i];
    i += 1;
  }
  flush();
  try {
    return { ok: true, re: new RegExp(`^${out}$`, "isd"), fields };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type SpanMatch = { groups: Record<string, string>; spans: Span[] };

/** Spans index into `title.trim()` and exclude surrounding whitespace. */
export function matchSpans(c: Compiled, title: string): SpanMatch | null {
  if (!c.ok) return null;
  const t = title.trim();
  const m = c.re.exec(t);
  if (!m) return null;
  const groups: Record<string, string> = {};
  const spans: Span[] = [];
  c.fields.forEach((f, idx) => {
    const raw = m[idx + 1];
    const range = m.indices?.[idx + 1];
    if (raw === undefined || !range) return;
    groups[f] = raw.trim();
    const start = range[0] + (raw.length - raw.trimStart().length);
    const end = range[1] - (raw.length - raw.trimEnd().length);
    if (end > start) spans.push([start, end, f]);
  });
  return { groups, spans };
}

// ── Team names ──────────────────────────────────────────────────────────────

export const normalizeTeam = (s: string) =>
  s.toLowerCase().split(/\s+/).filter(Boolean).join(" ");

function containsWords(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegex(needle)}(?![\\p{L}\\p{N}_])`,
    "u",
  ).test(haystack);
}

/** "matches" | "part" | "alias:<alias>" | null — mirrors patterns.match_how. */
export function matchHow(
  official: string,
  text: string | undefined,
  aliases: string[] = [],
): string | null {
  const a = normalizeTeam(official);
  const b = normalizeTeam(text ?? "");
  if (!b) return null;
  if (a === b) return "matches";
  if (containsWords(a, b) || containsWords(b, a)) return "part";
  for (const alias of aliases) {
    const al = normalizeTeam(alias);
    if (al && (al === b || containsWords(al, b) || containsWords(b, al)))
      return `alias:${alias}`;
  }
  return null;
}

export const aliasFromHow = (how: string | null) =>
  how?.startsWith("alias:") ? how.slice(6) : null;

// ── Stream time stamps ──────────────────────────────────────────────────────

export const STAMP_WINDOW_MINUTES = 8 * 60;

type Stamp = {
  y: number;
  m: number;
  d: number;
  hour?: number;
  minute?: number;
};

const ISO_STAMP =
  /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
const US_DATE = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/;

function validDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseStreamStamp(
  text: string,
  defaultYear?: number,
): Stamp | null {
  if (!text) return null;
  let m = ISO_STAMP.exec(text);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (validDate(y, mo, d)) {
      if (m[4] !== undefined && +m[4] < 24 && +m[5] < 60)
        return { y, m: mo, d, hour: +m[4], minute: +m[5] };
      return { y, m: mo, d };
    }
  }
  m = US_DATE.exec(text);
  if (m) {
    const y = m[3]
      ? +m[3] + (m[3].length === 2 ? 2000 : 0)
      : (defaultYear ?? new Date().getUTCFullYear());
    if (validDate(y, +m[1], +m[2])) return { y, m: +m[1], d: +m[2] };
  }
  return null;
}

function zonedParts(utcMs: number, tz: string) {
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
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    asUtc: Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    ),
  };
}

function zonedToUtc(naiveUtcMs: number, tz: string): number {
  const offset = zonedParts(naiveUtcMs, tz).asUtc - naiveUtcMs;
  const guess = naiveUtcMs - offset;
  const offset2 = zonedParts(guess, tz).asUtc - guess;
  return naiveUtcMs - offset2;
}

const dayNumber = (y: number, m: number, d: number) =>
  Date.UTC(y, m - 1, d) / 86_400_000;

/** Minutes between a stamp and the game start, reading the stamp as UTC or local. */
export function stampDeltaMinutes(
  stamp: Stamp,
  gameIso: string,
  tz: string,
): number {
  const game = Date.parse(gameIso);
  let safeTz = tz;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    safeTz = "UTC";
  }
  if (stamp.hour === undefined) {
    const local = zonedParts(game, safeTz);
    const utc = new Date(game);
    const s = dayNumber(stamp.y, stamp.m, stamp.d);
    const days = Math.min(
      Math.abs(s - dayNumber(local.y, local.m, local.d)),
      Math.abs(
        s -
          dayNumber(
            utc.getUTCFullYear(),
            utc.getUTCMonth() + 1,
            utc.getUTCDate(),
          ),
      ),
    );
    return days * 24 * 60;
  }
  const naive = Date.UTC(
    stamp.y,
    stamp.m - 1,
    stamp.d,
    stamp.hour,
    stamp.minute ?? 0,
  );
  const readings = [naive, zonedToUtc(naive, safeTz)];
  return Math.min(
    ...readings.map((r) => Math.floor(Math.abs(r - game) / 60_000)),
  );
}

// ── Preview evaluation ──────────────────────────────────────────────────────

export function findSkipTerm(title: string, terms: string[]): string | null {
  const lower = title.toLowerCase();
  return (
    terms.find((t) => t.trim() && lower.includes(t.trim().toLowerCase())) ??
    null
  );
}

export type PreviewContext = {
  skipTerms: string[];
  games: StreamCheckGame[];
  aliases: Record<string, string[]>;
  timezone: string;
};

export type PreviewResult =
  | { kind: "skipped"; term: string }
  | { kind: "error"; message: string }
  | { kind: "nofit" }
  | ({ kind: "fit" } & SpanMatch)
  | ({ kind: "noteam"; reversed: boolean } & SpanMatch)
  | ({
      kind: "matched";
      game: StreamCheckGame;
      homeHow: string;
      awayHow: string;
    } & SpanMatch);

function stampFits(
  groups: Record<string, string>,
  title: string,
  game: StreamCheckGame,
  tz: string,
): number | null | false {
  const year = new Date(game.game_time).getUTCFullYear();
  const stamp = parseStreamStamp(groups.time || title, year);
  if (!stamp) return null;
  const delta = stampDeltaMinutes(stamp, game.game_time, tz);
  return delta > STAMP_WINDOW_MINUTES ? false : delta;
}

export function evaluateStream(
  title: string,
  compiled: Compiled,
  ctx: PreviewContext,
): PreviewResult {
  const t = title.trim();
  const term = findSkipTerm(t, ctx.skipTerms);
  if (term) return { kind: "skipped", term };
  if (!compiled.ok) return { kind: "error", message: compiled.error };
  const m = matchSpans(compiled, t);
  if (!m) return { kind: "nofit" };
  const { home, away } = m.groups;
  if (!home || !away) return { kind: "fit", ...m };

  let best: {
    game: StreamCheckGame;
    delta: number | null;
    homeHow: string;
    awayHow: string;
  } | null = null;
  for (const g of ctx.games) {
    const homeHow = matchHow(g.home_team, home, ctx.aliases[g.home_team_id]);
    const awayHow = matchHow(g.away_team, away, ctx.aliases[g.away_team_id]);
    if (!homeHow || !awayHow) continue;
    const delta = stampFits(m.groups, t, g, ctx.timezone);
    if (delta === false) continue;
    const better =
      !best || (delta !== null && (best.delta === null || delta < best.delta));
    if (better) best = { game: g, delta, homeHow, awayHow };
  }
  if (best)
    return {
      kind: "matched",
      game: best.game,
      homeHow: best.homeHow,
      awayHow: best.awayHow,
      ...m,
    };
  const reversed = ctx.games.some(
    (g) =>
      matchHow(g.home_team, away, ctx.aliases[g.home_team_id]) &&
      matchHow(g.away_team, home, ctx.aliases[g.away_team_id]),
  );
  return { kind: "noteam", reversed, ...m };
}

/** Variant tags like "(Spanish)" swallowed by the {time} capture. */
export function suggestSkipTerms(
  results: PreviewResult[],
  skipTerms: string[],
): string[] {
  const have = new Set(skipTerms.map((s) => s.toLowerCase()));
  const out: string[] = [];
  for (const r of results) {
    if (!("groups" in r)) continue;
    const mm = /^([A-Za-z ]+)\) \(/.exec(r.groups.time ?? "");
    if (!mm) continue;
    const term = `(${mm[1]})`;
    if (!have.has(term.toLowerCase()) && !out.includes(term)) out.push(term);
  }
  return out;
}

// ── Visual pattern builder tokens ───────────────────────────────────────────

export type TokenType = "text" | Field;
export type Token = { text: string; gap: string; type: TokenType };

const DATE_WORD = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}(\/\d{2,4})?)$/;
const CLOCK_WORD = /^\d{1,2}:\d{2}(:\d{2})?$/;
const TIMEISH_WORD = /^\d{1,2}(:\d{2}){0,2}$/;
const AMPM_WORD = /^(am|pm|a\.m\.|p\.m\.)$/i;
const ZONE_WORD =
  /^(ET|EST|EDT|CT|CST|CDT|MT|MST|MDT|PT|PST|PDT|UTC|GMT|BST|CET)$/i;

function splitWord(w: string): string[] {
  if (/^[([][^()[\]]*[)\]]$/.test(w)) return [w];
  const lead: string[] = [];
  const trail: string[] = [];
  let core = w;
  while (core.length > 1 && /^[([]/.test(core)) {
    lead.push(core[0]);
    core = core.slice(1);
  }
  while (core.length > 1 && /[)\]]$/.test(core) && !/^[([]/.test(core)) {
    trail.unshift(core[core.length - 1]);
    core = core.slice(0, -1);
  }
  const label = /^([A-Za-z]+:)(\d.*)$/.exec(core);
  return [...lead, ...(label ? [label[1], label[2]] : [core]), ...trail];
}

function shouldMerge(prev: Token, next: Token): boolean {
  if (prev.gap.length !== 1) return false;
  const last = prev.text.split(/\s+/).pop() ?? "";
  return (
    (DATE_WORD.test(prev.text) && CLOCK_WORD.test(next.text)) ||
    (TIMEISH_WORD.test(last) && AMPM_WORD.test(next.text)) ||
    ((TIMEISH_WORD.test(last) || AMPM_WORD.test(last)) &&
      ZONE_WORD.test(next.text))
  );
}

/** Split literal text into word tokens; whitespace after a token is its gap. */
export function tokenizeLiteral(s: string): Token[] {
  const raw: Token[] = [];
  for (const m of s.matchAll(/(\S+)(\s*)/g)) {
    const parts = splitWord(m[1]);
    parts.forEach((p, i) =>
      raw.push({
        text: p,
        gap: i === parts.length - 1 ? m[2] : "",
        type: "text",
      }),
    );
  }
  const out: Token[] = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    if (prev && shouldMerge(prev, t)) {
      out[out.length - 1] = {
        ...prev,
        text: prev.text + prev.gap + t.text,
        gap: t.gap,
      };
    } else out.push(t);
  }
  return out;
}

/** Tokens for an example title; captured parts become typed tokens when the pattern fits. */
export function deriveTokens(title: string, compiled: Compiled): Token[] {
  const t = title.trim();
  const m = matchSpans(compiled, t);
  if (!m) return tokenizeLiteral(t);
  const tokens: Token[] = [];
  const pushLiteral = (s: string) => {
    const lead = /^\s*/.exec(s)![0];
    if (lead && tokens.length) tokens[tokens.length - 1].gap += lead;
    const rest = s.slice(lead.length);
    if (rest) tokens.push(...tokenizeLiteral(rest));
  };
  let pos = 0;
  for (const [a, b, f] of [...m.spans].sort((x, y) => x[0] - y[0])) {
    if (a < pos) continue;
    pushLiteral(t.slice(pos, a));
    tokens.push({ text: t.slice(a, b), gap: "", type: f as Field });
    pos = b;
  }
  pushLiteral(t.slice(pos));
  return tokens;
}

const escapeLiteral = (s: string) =>
  s.replace(/\{/g, "{{").replace(/\}/g, "}}");

/** Consecutive tokens with the same capture type collapse into one placeholder. */
export function patternFromTokens(tokens: Token[]): string {
  let out = "";
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "text") {
      out += escapeLiteral(t.text) + t.gap;
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < tokens.length && tokens[j + 1].type === t.type) j += 1;
    out += `{${t.type}}` + tokens[j].gap;
    i = j + 1;
  }
  return out.trimEnd();
}

/**
 * Retag token `i`. Home and Away are unique: tagging one reverts any other
 * token of that type unless it's adjacent (so multi-word names can be tagged
 * word by word). Turning a capture back into exact text splits it into words.
 */
export function setTokenType(
  tokens: Token[],
  i: number,
  type: TokenType,
): Token[] {
  const next = tokens.slice();
  const cur = next[i];
  if (cur.type !== "text" && type === "text") {
    const sub = tokenizeLiteral(cur.text);
    sub[sub.length - 1] = { ...sub[sub.length - 1], gap: cur.gap };
    next.splice(i, 1, ...sub);
    return next;
  }
  next[i] = { ...cur, type };
  if (type === "home" || type === "away") {
    let lo = i;
    let hi = i;
    while (lo > 0 && next[lo - 1].type === type) lo -= 1;
    while (hi < next.length - 1 && next[hi + 1].type === type) hi += 1;
    next.forEach((t, j) => {
      if (t.type === type && (j < lo || j > hi))
        next[j] = { ...t, type: "text" };
    });
  }
  return next;
}
