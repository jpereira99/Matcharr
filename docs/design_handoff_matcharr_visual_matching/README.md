# Handoff: Matcharr visual stream matching (League Profiles + Team Channels)

## Overview
A redesign of Matcharr's **League Profiles** and **Team Channels** pages. Users currently hand-type a pattern string and only find out at game time whether it works. The new flow replaces that guesswork with visual matching:

- **League Profile detail page**: build the pattern by tagging parts of a real Dispatcharr stream title (Home / Away / Time / Number / Exact text). Add skip terms for variant feeds like `(Spanish)`. See a live preview of every stream checked against today's ESPN games.
- **Team Channels**: an overview grid showing each team's next game and status, plus a per-team detail page. The detail page lists every candidate stream for each upcoming game, ranked, with a reason for each result. The user can apply a **one-game manual override**.

It also fixes a real bug. For the NYCFC channel, `(Apple) (MLS) 009 |  New_York vs. St. Louis (Spanish) (2026-09-26 19:25:25)` wins over the plain English stream. Two things cause this:
- `_find_matching_stream` returns the **first** stream that fits.
- The lazy `{time}` capture (`(.+?)`) swallows `Spanish) (2026-…`.

## About the design files
The `.dc.html` files in this bundle are **design references built in HTML**. They are prototypes showing the intended look and behavior, not production code. Recreate them in the existing Matcharr frontend (`frontend/`, React 19 + Vite + Tailwind v4, TanStack Query), using its components in `frontend/src/components/ui/*` and the tokens in `frontend/src/main.css`. The backend work goes in the FastAPI app under `backend/app/`.

To open a prototype, open the `.dc.html` file in a browser with `support.js` in the same folder. The logic sits in the `<script data-dc-script>` class at the bottom of each file. It includes a JS port of `patterns.py` (`compile`, `teamsMatch`/`how`) and mock data: `STREAMS`, `GAMES`, `TEAMS`, `PROFILES`.

`reference/Current UI.dc.html` is a faithful recreation of today's two pages, for comparison.

## Fidelity
**High-fidelity.** The prototypes use the exact Matcharr tokens, type, radii and component styles from `main.css` and `DESIGN.md`. Recreate them pixel-close using the existing `Card`, `Badge`, `Button`, `Input`, `Label`, `Tabs`, `Toggle`, `Dialog`, `TeamLogo` and `LeagueBadge` components. The one new color is **violet for manual overrides** (see Tokens).

---

## Screen 1: League Profile detail (`League Profile 1a Refined.dc.html`)
**Route:** `/profiles/:id`, which replaces the edit drawer. "Create Profile" can reuse the same page at `/profiles/new`.

**Layout**
- Breadcrumb `League Profiles › {name}` at 12px, muted, with a `chevron-right` icon at 12px.
- Header: league logo at 44px, h1 at 24/32 weight 800 with tracking -0.025em, and the subtitle "{n} ESPN games today · {n} teams mapped" at 14px muted. On the right: "Unsaved changes" (12px muted, shown only when there are changes), a ghost "Cancel" button and a primary "Save Changes" button. Save sits at 50% opacity until something changes.
- Two-column grid: `repeat(auto-fit, minmax(min(100%,440px),1fr))`, gap 20px, aligned to start. Each column has a 10px uppercase muted caption with letter-spacing .08em:
  - **Left, "Settings"**: the editable cards, stacked with a 16px gap.
  - **Right, "Preview"**: read-only and `position: sticky; top: 24px`. The caption carries the right-aligned note "Updates as you edit · nothing is routed until you save".

**Cards.** Each uses `Card` (radius 12, border `--color-border`, `--shadow-card`, padding 20).
1. **Basics** (no number): Name (`Input`), ESPN League (select from `ESPN_LEAGUE_PRESETS`), Enabled `Toggle` with the label "Enabled"/"Disabled".
2. **Streams**, step ① (a 22px accent circle with `bg accent/15`, text accent, 12px weight 700). Helper: "Which Dispatcharr streams to look through. **{n} streams** right now." Fields:
   - M3U Account (select)
   - Channel Group (select)
   - Title contains · optional (mono `Input`), which maps to today's `stream_name_filter`
3. **Title format**, step ②. Helper: "Click a part of the title, then choose what it is."
   - **Example stream** select, listing real titles from the current stream pool.
   - **Token row**: the example title split into tokens. Each token is a button made of a caption and a chip:
     - Caption: 9px/11px weight 600, uppercase, letter-spacing .08em. Home is `#fbbf24`, Away is `#93c5fd`, the rest muted. Empty for exact text.
     - Chip: mono 13px, padding 5×8, radius 6.
     - Chip colors: exact text has border `#1e2a3a`, no fill, text `#94a3b8`. Home has border `#f59e0b` and fill `rgb(245 158 11 / .15)`. Away has border `#3b82f6` and fill `rgb(59 130 246 / .18)`. Time and Number have border `#64748b` and fill `#1c2230`.
     - Selected token: border `#34d399` plus ring `0 0 0 2px rgb(52 211 153/.3)`.
     - Keep the original whitespace between tokens (a gap of 2+ spaces renders as an 8px margin).
   - **Type picker row** (surface-raised box): "Selected “{token}” is" followed by a segmented control: Exact text · Home · Away · Time · Number. The active item gets a `#1c2230` background, and its text is the Home/Away color when relevant. Only one token can be Home, and only one Away; tagging a second one reverts the first to Exact text.
   - **ESPN check line**: a 14px `circle-check` icon in success green when the example lines up with an ESPN game, otherwise `circle-alert` in warning amber. Copy examples:
     - "Lines up with today's ESPN game: New York City FC (home) vs St. Louis City SC, via the alias “New_York”."
     - "No ESPN game today has “X” at home and “Y” away. Home and Away may be reversed."
   - **Footer bar** (surface-raised, top border): the generated pattern string in mono 12px `#94a3b8`, and an outline button "Edit as text" (pencil icon) that switches to "Back to visual". Text mode swaps the token UI for a mono `Input` holding the raw pattern, with the helper "Placeholders: {home} {away} {time} {n}".
4. **Skip variants**, step ③. Helper: "Titles containing any of these are never routed." One inline chip row with 6px gap:
   - **Skip term chip**: mono 12px, background `rgb(239 68 68/.15)`, text `#ef4444`, with an × button.
   - **Suggested term chip**: dashed border `rgb(239 68 68/.45)`, a `+` icon and the term. Suggested terms are tags found in the streams' `{time}` capture matching `^([A-Za-z ]+)\) \(`. Clicking one adds it.
   - **"+ Add" chip** (dashed `#1e2a3a`, muted): turns into an inline input about 90px wide with an accent ring. Enter or ✓ adds the term, blur commits, Esc cancels.
   - When suggestions exist, a helper line reads "Dashed terms were spotted in your streams. Click one to skip it."

**Preview panel** (an outlined card with no fill)
- Summary: large numbers at 30/36 weight 800:
  - **{n}** in `#22c55e` with the caption "ready to route"
  - **{n}** in `#f59e0b` with the caption "in conflict" (only when above 0)
  - On the right: "{n} streams checked / against {n} ESPN games today"
- A 6px stacked bar (gap 2px) in green / amber / red / `#334155` for ok / conflict / skipped / other.
- `Tabs`: All {n} · Matched {n} · Skipped {n} · No match {n}.
- Rows (padding 12×20, bottom border):
  - The stream title in mono 12/1.6 with pre-wrap. Captured ranges are highlighted: Home `rgb(245 158 11/.18)` with text `#fbbf24`, Away `rgb(59 130 246/.2)` with text `#93c5fd`, Time and Number `rgb(100 116 139/.22)` with text `#f1f5f9`. Literal text is `#64748b`.
  - Then a `Badge` and a reason:
    - **Matched** (success): "NYCFC vs St. Louis · 7:30 PM"
    - **Conflict** (warning): "2 streams fit X vs Y. Add a skip term."
    - **Skipped** (danger): "contains (Spanish)"
    - **No fit** (muted): "doesn't fit the title format"
    - **No game** (muted): "no ESPN game today for “A” vs “B”"
    - **Fits** (muted): "tag a Home and an Away to check teams"

---

## Screen 2: Team Channels overview (`Team Channels Refined.dc.html`, list view)
**Route:** `/teams`

- Header: "Team Channels" with the subtitle "Which stream each team's channel will use for its next game.", and a primary sm button "+ Add Team".
- **Summary card** (outlined, padding 16×20):
  - Four big numbers: **ready** in `#22c55e`, **need a look** in `#f59e0b`, **overridden** in `#a78bfa`, **streams not listed yet** in `#64748b`.
  - On the right: "{n} teams · next game for each / Checked against Dispatcharr just now".
  - A 6px stacked bar in the same colors.
- Filters: league `Tabs` (All · MLS · NFL · MLB) and a dashed toggle chip "Only teams that need a look". When active it shows a warning tint.
- **Team cards** in a grid `repeat(auto-fill,minmax(min(100%,300px),1fr))` with gap 16. Each card is a button (radius 12, padding 18×20); on hover the border becomes `#334155` and the shadow `--shadow-card-hover`. Contents:
  - Row: `TeamLogo` at 40px, the name (14 weight 600), a channel line (`link-2` icon, mono channel number, channel name) and a status `Badge` on the right.
  - Next-game strip (`#1c2230`, radius 8, padding 8×10, 12px): "Sat 9/26 7:30 PM · vs [opp logo 18] St. Louis City".
  - Disabled teams render at 50% opacity with an "Off" badge.
- Status badges, based on the team's **next** game:
  - **Ready** (success): exactly one stream fits.
  - **{n} fit** (warning): more than one fits.
  - **No match** (warning): streams mention the game but none fit, a near miss.
  - **Not listed** (muted): no streams mention the game.
  - **Override** (violet): the user picked a stream manually.

## Screen 3: Team detail (same file, team view)
**Route:** `/teams/:id`

- Breadcrumb `Team Channels › {team}`.
- Header: logo at 52px, name at 22/28 weight 800, a `LeagueBadge` and a link to the league profile. On the right, the label "Routing on"/"Routing off" and a `Toggle`, which maps to `team_channels.enabled`.
- Two settings cards in a grid `repeat(auto-fit,minmax(min(100%,280px),1fr))`. Each header has a 24px icon tile (radius 8, `bg accent/15`, icon in accent).
  - **Channel** (`tv` icon): a select of Dispatcharr channels shown as "{number} · {name}", replacing manual ID entry. Under it:
    - "On the channel now": the mono title of the current stream from `get_channel_streams`.
    - A switch note, such as "Switches to stream 009 at 7:00 PM." (foreground color), "Already on the chosen stream." or "Routing is off for this team." (muted).
  - **Names in titles** (`tag` icon): "ESPN calls this team **{name}**. Add any other names your provider uses." Below that, alias chips (`#1c2230` with ×), suggested aliases as dashed accent chips with `+`, and a "+ Add" chip that becomes an inline input. The Enter / blur / Esc behavior matches Skip variants.
- **Games and streams** (`calendar-days` icon): a flex row that wraps.
  - **Upcoming** column (flex 1 1 240px, max 300px): one full-width card per game (radius 12, padding 14×16). Each shows the date and time, "vs/@ [logo 22] Opponent full name", a status badge and "switches {time}" on the right. The selected game has border `#34d399` and background `rgb(52 211 153/.06)`.
  - **Streams** column (flex 999 1 400px): the caption "Streams for {day} vs {opp}", then an outlined container.
    - Info bar (`#1c2230`, `clock` icon): "Switches at 7:00 PM, 30 min before kickoff · 3 streams mention this game." When there's a conflict it adds "2 fit. Override one or add a skip term in {profile}." When an override is active, a violet "Remove override" link sits on the right.
    - **Candidate cards** (radius 12, border, a 3px top border in the status color, padding 16):
      - Badge and rank note. The badge is one of: **Will route** (green; "Only stream that fits" / "Listed first in Dispatcharr"), **Override** (violet; "This game only. Goes back to automatic after the game ends."), **Also fits** (amber; "Override to use this one instead"), **Skipped** (red, 80% opacity) or **Rejected** (muted, 80% opacity).
      - The title in mono on `#0c0f14`, with Home and Away highlighted as on Screen 1.
      - Reason rows (12px): a ✓ (`check`, green), ✗ (`x`, red) or `ban` (red) icon; a 62px label ("Home" in amber or "Away" in blue, or "Skip list" in muted); then the text:
        - ✓ “New_York” is an alias of New York City FC
        - ✓ “St. Louis” is part of St. Louis City SC
        - ✗ “NY Giants” isn't a known name for New York Giants. When the failing side is **our** team, this includes an inline dashed `+ NY Giants` button that adds the alias.
        - ⊘ contains (Spanish), skipped by MLS Apple
      - Override button (violet outline: background `rgb(167 139 250/.12)`, border `rgb(167 139 250/.5)`, text `#a78bfa`, `hand` icon):
        - "Override for this game" on Also fits
        - "Override anyway" on Skipped
        - "Remove override" (neutral) on the active override
        - Hidden when the stream is the sole automatic winner, and on Rejected streams.
    - Empty state (`clock` icon in a 44px circle): "No streams listed for this game yet" / "Providers usually add them a few hours before kickoff. Matcharr checks every 5 minutes."
- **Add Team** dialog (`Dialog`, center variant): selects for League Profile, ESPN Team and Dispatcharr Channel, then Add Team and Cancel buttons.

---

## Interactions & behavior
- Every edit on the League Profile page recomputes the preview locally with no request, then marks the page dirty. Save calls `PATCH /api/profiles/{id}`; Cancel reverts.
- The preview's source data (stream titles plus today's ESPN games) should come from one fetch when the page opens (see API), then get re-evaluated client-side with a TS port of `patterns.py`. The prototype has a working port: `compile()` builds the `^…$` regex with flags `isd` (the `d` flag gives capture indices for highlighting), and `how()`/`teamsMatch` mirror `teams_match`.
- Team Channels: clicking a card opens the detail page and scrolls to the top. Game cards switch the candidate list. Override and alias actions save immediately (optimistic update, then invalidate `["team-channels"]`, `["team-status"]`).
- Transitions: 150ms ease on color, opacity and the toggle thumb, as in `DESIGN.md`. No page transitions.
- Loading: use the existing `Skeleton` patterns for the card grid and the preview list.

## Backend changes (feasibility, all within Matcharr + existing Dispatcharr endpoints)
1. **`league_profiles.exclude_terms_json`** (TEXT, JSON list). A stream is skipped if its title contains any term (case-insensitive). Check this before pattern matching in `run_match_cycle`, `preview_routing` and `upcoming_stream_matches`.
2. **Stream source filters**: add `m3u_account_id` and `channel_group` to `league_profiles`. Dispatcharr stream objects carry `m3u_account` and `channel_group`. First confirm whether `/api/channels/streams/` accepts them as query filters. If it doesn't, filter locally after `list_streams()`. `stream_name_filter` stays as "Title contains".
3. **Rank every candidate instead of taking the first match**: replace `_find_matching_stream` with a function that returns every relevant stream as `{stream_id, name, kind: fit|skipped|rejected, groups, spans, our_side_result, opp_side_result, skip_term}`. A stream counts as relevant if it fits the pattern and at least one side matches. The winner is the first `fit`, or the override. Return the reasons in the API so the UI never recomputes routing decisions for Team Channels.
   - Recommended: also score `{time}` closeness to ESPN `game_time` when it parses, to tie-break duplicate feeds. The prototype only compares the date prefix.
4. **Overrides table**: `stream_overrides(team_channel_id, espn_event_id, stream_id, created_at)`, checked before automatic ranking. Apply it through the existing `patch_channel_streams`. Delete it (or ignore it) once the game's status is `post`; it never outlives its game.
5. **Alias suggestions**: from rejected candidates where our side failed but the opponent matched, suggest `groups[our_side]`.
6. **Channel picker**: `GET /api/dispatcharr/channels` already exists. Show `channel_number · name` and keep storing `dispatcharr_channel_id`.

**New or extended endpoints (suggested)**
- `GET /api/profiles/{id}/stream-check`: returns the filtered stream titles plus the cached ESPN games for the lookahead window, used by the client-side preview.
- `GET /api/team-channels/status`: per team, `{next_game, status, winner, override}` for the overview.
- `GET /api/team-channels/{id}/games`: upcoming games, each with its ranked `candidates[]`.
- `PUT` / `DELETE /api/team-channels/{id}/overrides/{espn_event_id}` with the body `{stream_id}`.

## State (frontend)
- League Profile page: `form` (name, league, enabled, source filters, pattern, tokens/types, `textMode`, `excludeTerms`), `selectedToken`, `sampleIndex`, `previewFilter`, `dirty`. The server data is `stream-check`.
- Team Channels: `leagueFilter`, `attentionOnly`; the detail page has `selectedGameId` and the inline alias input state. The server data is `team-status` and `team-games/{id}`.

## Design tokens
From `frontend/src/main.css` (dark):
- `--color-background` #0c0f14 · `--color-surface` #151a22 · `--color-surface-raised` #1c2230 · `--color-border` #1e2a3a · `--color-sidebar` #090c10
- `--color-foreground` #f1f5f9 · `--color-muted` #64748b · `--color-accent` #34d399 (hover #6ee7b7, foreground #022c22)
- `--color-success` #22c55e · `--color-warning` #f59e0b · `--color-danger` #ef4444 · `--color-info` #3b82f6

Radii: sm 6px, md 8px, lg 12px. Shadows: `--shadow-card`, `--shadow-card-hover`, `--shadow-dialog`. Fonts: DM Sans (UI) and DM Mono (titles, patterns, IDs).

**New tokens to add**
- `--color-override: #a78bfa`, with its tint `rgb(167 139 250 / .12–.16)`. Light-mode suggestion: `#7c3aed`.
- `--color-capture-home: #f59e0b` (text `#fbbf24`, tint `.15–.18`) and `--color-capture-away: #3b82f6` (text `#93c5fd`, tint `.18–.2`). These are semantic aliases of the warning and info colors for pattern captures.
- `#94a3b8` is used for secondary mono text on raised surfaces.

Light-mode values for the new tokens need a quick contrast pass; the prototypes are dark-only.

## Assets
- Icons: lucide (`lucide-react` is already a dependency). Used: radio, layout-dashboard, trophy, users, activity, settings, moon, chevron-right, chevron-down, plus, x, check, ban, circle-check, circle-alert, pencil, mouse-pointer-click, link-2, tv, tag, calendar-days, clock, hand, triangle-alert.
- Logos: ESPN CDN via the existing `espnLogos.ts` (`teamLogoUrl`, `leagueLogoUrl`). No new assets.

## Screenshots
Captured at a 1440px desktop layout from the prototypes, in `screenshots/`:

**League Profile**
- `01-league-profile.png`: default state, top of page (Basics, Streams, Title format, Preview summary)
- `02-league-profile.png`: scrolled down (token picker, ESPN check line, pattern footer, Skip variants with a suggested chip)
- `03-league-profile.png`: "Edit as text" mode
- `04-league-profile.png`: after removing `(Spanish)`; the Preview shows conflicts and the term moves back to a suggestion

**Team Channels**
- `01-team-channels.png`: overview (summary, filters, team card grid)
- `02-team-channels.png`: NYCFC detail, top (Channel, Names in titles, Upcoming, Will route and Rejected candidates)
- `03-team-channels.png`: NYCFC detail, scrolled (Skipped Spanish stream with "Override anyway")
- `04-team-channels.png`: Charlotte with 2 fitting streams (Will route and Also fits)
- `05-team-channels.png`: Charlotte after "Override for this game" (violet Override state, "Remove override")
- `06-team-channels.png`: Giants near miss (Rejected, inline `+ NY Giants` alias action)
- `07-team-channels.png`: Giants after adding the alias, now Will route
- `08-team-channels.png`: Add Team dialog

In the prototypes the icons are drawn with CSS masks; for the screenshots they were swapped to inline SVGs. Use `lucide-react` in the real build.

## Files
- `League Profile 1a Refined.dc.html`: Screen 1 (interactive).
- `Team Channels Refined.dc.html`: Screens 2 and 3 plus the Add Team dialog (interactive).
- `reference/Current UI.dc.html`: today's pages, for comparison.
- `support.js`: the runtime needed to open the `.dc.html` files in a browser.

Repo files this touches: `frontend/src/pages/LeagueProfiles.tsx`, `frontend/src/pages/TeamChannels.tsx`, `frontend/src/components/StreamPatternField.tsx`, `frontend/src/components/PatternTester.tsx` (both replaced by the token builder and preview), `frontend/src/App.tsx` (new routes), `frontend/src/lib/api.ts` and `types.ts`, `backend/app/services/matcher.py`, `backend/app/services/patterns.py`, `backend/app/models.py`, `backend/app/database.py`, `backend/app/routers/profiles.py`, `backend/app/routers/channels.py`.
