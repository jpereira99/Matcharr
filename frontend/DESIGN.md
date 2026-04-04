# Matcharr Design System

Comprehensive design reference for the Matcharr frontend. All new features and components
should follow the guidelines in this document.

---

## 1. Design Principles

1. **Sports-first visual identity** — Team logos, league badges, and team colors are first-class
   citizens. The UI should feel like a sports control room, not a generic CRUD app.
2. **Information density with clarity** — Dashboards show a lot of data. Use clear hierarchy,
   tabular numerals, and consistent spacing to keep things readable at a glance.
3. **Dark + Light parity** — Both themes are fully supported. Dark mode is the default
   (matching the operational/media-server context). Light mode uses the same layout with
   adjusted tokens.
4. **Accessible by default** — WCAG AA contrast minimums on all text. Keyboard-navigable
   components. ARIA roles on interactive widgets.

---

## 2. Color System

Tokens are defined as CSS custom properties on `:root` (dark) and `[data-theme="light"]`.
Always reference tokens — never hard-code hex values in components.

### 2.1 Dark Mode (default)

| Token                       | Value     | Usage                                 |
| --------------------------- | --------- | ------------------------------------- |
| `--color-background`        | `#0c0f14` | Page background                       |
| `--color-surface`           | `#151a22` | Card / section background             |
| `--color-surface-raised`    | `#1c2230` | Elevated surfaces, hover states       |
| `--color-border`            | `#1e2a3a` | Card borders, dividers                |
| `--color-sidebar`           | `#090c10` | Sidebar background                    |
| `--color-foreground`        | `#f1f5f9` | Primary text                          |
| `--color-muted`             | `#64748b` | Secondary / helper text               |
| `--color-accent`            | `#34d399` | Primary actions, links, active states |
| `--color-accent-hover`      | `#6ee7b7` | Accent on hover                       |
| `--color-accent-foreground` | `#022c22` | Text on accent-colored backgrounds    |
| `--color-secondary`         | `#f59e0b` | Secondary highlights, warnings        |
| `--color-danger`            | `#ef4444` | Destructive actions, errors           |
| `--color-success`           | `#22c55e` | Positive states                       |
| `--color-warning`           | `#f59e0b` | Caution states                        |
| `--color-info`              | `#3b82f6` | Informational states                  |

### 2.2 Light Mode

| Token                       | Value     | Usage                             |
| --------------------------- | --------- | --------------------------------- |
| `--color-background`        | `#f8fafc` | Page background                   |
| `--color-surface`           | `#ffffff` | Card / section background         |
| `--color-surface-raised`    | `#f1f5f9` | Elevated surfaces                 |
| `--color-border`            | `#e2e8f0` | Card borders, dividers            |
| `--color-sidebar`           | `#f1f5f9` | Sidebar background                |
| `--color-foreground`        | `#0f172a` | Primary text                      |
| `--color-muted`             | `#64748b` | Secondary text                    |
| `--color-accent`            | `#059669` | Primary actions (darker for a11y) |
| `--color-accent-hover`      | `#047857` | Accent on hover                   |
| `--color-accent-foreground` | `#ffffff` | Text on accent backgrounds        |
| `--color-secondary`         | `#d97706` | Secondary highlights              |
| `--color-danger`            | `#dc2626` | Destructive actions               |
| `--color-success`           | `#16a34a` | Positive states                   |
| `--color-warning`           | `#d97706` | Caution states                    |
| `--color-info`              | `#2563eb` | Informational states              |

### 2.3 Team Color Integration

ESPN provides `color` and `alternateColor` (hex without `#`) per team. Use these for:

- Subtle left-border or top-border accents on team cards (4 px wide, 20 % opacity).
- Team logo fallback badges (colored circle with initials).
- Never use team colors for text or full backgrounds — only decorative accents.

---

## 3. Typography

### 3.1 Font Stacks

```
--font-sans:     "Inter", ui-sans-serif, system-ui, sans-serif;
--font-heading:  "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono:     "JetBrains Mono", ui-monospace, monospace;
```

If Adobe Fonts are available (Typekit project loaded):

```
--font-sans:     "aktiv-grotesk", "Inter", ui-sans-serif, system-ui, sans-serif;
--font-heading:  "acumin-pro", "Plus Jakarta Sans", "Inter", ui-sans-serif, sans-serif;
--font-mono:     "source-code-pro", "JetBrains Mono", ui-monospace, monospace;
```

### 3.2 Type Scale

| Name   | Size     | Weight  | Line Height | Usage                        |
| ------ | -------- | ------- | ----------- | ---------------------------- |
| `xs`   | 0.75 rem | 400–500 | 1 rem       | Badges, timestamps, captions |
| `sm`   | 0.875rem | 400–500 | 1.25 rem    | Helper text, table cells     |
| `base` | 1 rem    | 400     | 1.5 rem     | Body text, form labels       |
| `lg`   | 1.125rem | 600     | 1.75 rem    | Card titles, section headers |
| `xl`   | 1.25 rem | 600     | 1.75 rem    | Sub-page headings            |
| `2xl`  | 1.5 rem  | 700     | 2 rem       | Page titles                  |
| `3xl`  | 1.875rem | 700     | 2.25 rem    | Dashboard hero numbers       |

### 3.3 Numeric Display

All data-heavy containers should set `font-variant-numeric: tabular-nums` so columns of
numbers align vertically. The `tabular-nums` class in Tailwind handles this.

Use monospace (`--font-mono`) for:

- Stream patterns and regex
- Timestamps with seconds
- Channel IDs and ESPN IDs

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

Follow Tailwind's default 4 px base: `1 = 0.25 rem`, `2 = 0.5 rem`, ..., `6 = 1.5 rem`,
`8 = 2 rem`, `10 = 2.5 rem`, `12 = 3 rem`.

Standard usage:

- Card padding: `p-5` (1.25 rem) or `p-6` (1.5 rem)
- Section gap: `gap-6` (1.5 rem)
- Page padding: `p-6` mobile, `p-8 lg:p-10` desktop
- Inline element gap: `gap-2` (0.5 rem)

### 4.2 Border Radius

| Token         | Value     | Usage               |
| ------------- | --------- | ------------------- |
| `--radius-sm` | 0.375 rem | Badges, small pills |
| `--radius-md` | 0.5 rem   | Buttons, inputs     |
| `--radius-lg` | 0.75 rem  | Cards, dialogs      |
| `--radius-xl` | 1 rem     | Large feature cards |

### 4.3 Breakpoints

| Name | Min width | Sidebar   | Grid columns |
| ---- | --------- | --------- | ------------ |
| sm   | 640 px    | Hidden    | 1            |
| md   | 768 px    | Collapsed | 2            |
| lg   | 1024 px   | Expanded  | 2–3          |
| xl   | 1280 px   | Expanded  | 3–4          |

### 4.4 Sidebar

- Expanded: 260 px fixed.
- Collapsed: 64 px, icons only.
- Mobile (< md): hidden by default, opens as overlay drawer.
- Preference stored in `localStorage("matcharr-sidebar")`.

---

## 5. Component API Reference

### 5.1 Button

```tsx
<Button variant="primary|secondary|ghost|outline|danger|success" size="sm|md|lg">
```

| Variant     | Background                   | Text                        |
| ----------- | ---------------------------- | --------------------------- |
| `primary`   | `--color-accent`             | `--color-accent-foreground` |
| `secondary` | `--color-secondary`          | white                       |
| `ghost`     | transparent → surface-raised | `--color-foreground`        |
| `outline`   | transparent                  | `--color-accent`            |
| `danger`    | `--color-danger`             | white                       |
| `success`   | `--color-success`            | white                       |

### 5.2 Card

```tsx
<Card variant="default|outlined|raised" colorAccent="#hexcolor">
```

- `colorAccent` renders a 3 px top border in the given color (used for team colors).
- `raised` uses `--color-surface-raised` and a stronger shadow.

### 5.3 Badge

```tsx
<Badge variant="default|success|warning|danger|info|accent|muted">
```

Each variant uses the matching semantic color at 15 % opacity for background, full color
for text.

### 5.4 Input

```tsx
<Input size="sm|md" />
```

- Background: `--color-surface` with border `--color-border`.
- Focus: ring using `--color-accent` at 30 % opacity.
- Error state via `aria-invalid` — border becomes `--color-danger`.

### 5.5 Dialog / Drawer

```tsx
<Dialog open onClose variant="center|panel">
```

- `center`: traditional centered modal.
- `panel`: slide-in from right, full height, 480 px wide.

### 5.6 Toggle

```tsx
<Toggle checked onChange />
```

Track background: muted when off, accent when on. Thumb: white circle.

### 5.7 Tabs

```tsx
<Tabs value onChange items={[{ id, label, icon? }]} />
```

Horizontal pill-style tabs with accent underline on active item.

### 5.8 Skeleton

```tsx
<Skeleton className="h-4 w-32" />
```

Animated shimmer placeholder. Uses `--color-surface-raised` → `--color-border` gradient.

### 5.9 EmptyState

```tsx
<EmptyState
  icon={Trophy}
  title="No profiles yet"
  description="..."
  action={<Button>Create</Button>}
/>
```

Centered layout with icon, heading, paragraph, optional CTA.

### 5.10 StatusDot

```tsx
<StatusDot status="online|offline|warning" />
```

8 px colored circle. Online = success, offline = danger, warning = warning.

### 5.11 ThemeToggle

```tsx
<ThemeToggle />
```

Cycles through dark → light → system. Persists to `localStorage("matcharr-theme")`.

### 5.12 TeamLogo

```tsx
<TeamLogo sport="baseball" abbreviation="MIN" size={32} />
```

- Renders `<img>` from ESPN CDN URL.
- Automatically uses dark variant when theme is dark.
- On load error: falls back to colored initials circle.

### 5.13 LeagueBadge

```tsx
<LeagueBadge league="mlb" label="MLB" />
```

Small league logo + text label. Uses ESPN CDN combiner URL.

---

## 6. ESPN Logo & Brand Integration

### 6.1 Team Logo URLs (deterministic)

```
Default : https://a.espncdn.com/i/teamlogos/{sport}/500/{abbr_lower}.png
Dark    : https://a.espncdn.com/i/teamlogos/{sport}/500-dark/{abbr_lower}.png
```

Example: `https://a.espncdn.com/i/teamlogos/mlb/500/min.png`

### 6.2 League Logo URLs

```
https://a.espncdn.com/combiner/i?img=/i/leaguelogos/500/{league}.png&w=80&h=80&transparent=true
```

### 6.3 Fallback Strategy

1. Attempt ESPN CDN `<img>`.
2. On error → show initials badge using team `color` as background.
3. Cache broken URLs in a `Set` so repeated renders don't flash.

### 6.4 Size Guidelines

| Context               | Logo size | Notes                   |
| --------------------- | --------- | ----------------------- |
| Sidebar / nav         | 20–24 px  | Icon-sized              |
| Card row (table cell) | 28–32 px  | Next to team name       |
| Card hero             | 48–64 px  | Team channels grid card |
| Dashboard stat        | 36–40 px  | Upcoming games list     |

---

## 7. Status & State Colors

| State   | Token             | When to use                            |
| ------- | ----------------- | -------------------------------------- |
| Success | `--color-success` | Stream matched, connection OK, enabled |
| Danger  | `--color-danger`  | Error, unreachable, delete action      |
| Warning | `--color-warning` | Outside window, no match, caution      |
| Info    | `--color-info`    | Informational badges, help tooltips    |
| Accent  | `--color-accent`  | Primary actions, active nav, links     |
| Muted   | `--color-muted`   | Disabled, secondary text, placeholders |

Routing preview status mapping:

| Backend status      | Color   | Label             |
| ------------------- | ------- | ----------------- |
| `stream_found`      | success | Stream matched    |
| `no_stream_match`   | warning | No stream match   |
| `no_active_game`    | muted   | No game in cache  |
| `outside_window`    | muted   | Outside window    |
| `pattern_error`     | danger  | Pattern error     |
| `dispatcharr_error` | danger  | Dispatcharr error |

---

## 8. Animation & Transitions

- **Default transition**: `150ms ease` for color/opacity/transform changes.
- **Dialog enter**: fade + scale from 95 % → 100 % (center), slide from right (panel).
- **Sidebar collapse**: `200ms ease` width transition.
- **Skeleton shimmer**: `1.5s ease-in-out infinite` horizontal gradient sweep.
- **Loading states**: Show skeleton placeholders for 0 ms (instant) — no artificial delay.
- **Page transitions**: None (keep it snappy). React Router handles instant swaps.

---

## 9. Accessibility

- **Contrast**: All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text).
- **Focus rings**: 2 px offset ring using `--color-accent` at 50 % opacity. Never remove
  `:focus-visible` outlines.
- **ARIA**: Dialogs use `role="dialog"` + `aria-modal`. Toggles use `role="switch"`.
  Tabs use `role="tablist"` / `role="tab"` / `role="tabpanel"`.
- **Reduced motion**: Wrap animations in `@media (prefers-reduced-motion: no-preference)`.
- **Keyboard**: All interactive elements reachable via Tab. Escape closes dialogs.

---

## 10. Dark / Light Mode Implementation

### 10.1 Switching Mechanism

```html
<html data-theme="dark|light"></html>
```

JavaScript reads `localStorage("matcharr-theme")`. Values: `"dark"`, `"light"`, `"system"`.
System follows `prefers-color-scheme` media query.

### 10.2 CSS Structure

```css
:root {
  /* dark tokens (default) */
}
[data-theme="light"] {
  /* light overrides */
}
```

### 10.3 Image Variants

Team logos: use `500-dark/` path in dark mode, `500/` in light mode.

### 10.4 Shadow Adjustments

Dark mode: shadows use black at 30–50 % opacity.
Light mode: shadows use slate-900 at 5–10 % opacity.
