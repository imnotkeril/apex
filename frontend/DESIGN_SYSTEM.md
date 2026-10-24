# APEX Content Engine — Design System (single source of truth)

> Every one of the 14 pages is built **only** from the tokens and components defined here.
> Style direction (validated by `ui-ux-pro-max`): **Flat editorial** — no shadows, hairline
> borders, near-square corners, warm cream canvas, lavender soft-accent, black uppercase
> headings. SVG icons only (Lucide), never emoji.
>
> Live reference: run the app → **`/design`** (styleguide) and **`/`** (Dashboard = canonical page).
> Tokens live in `tailwind.config.js`. Components live in `components/ui/*`.
>
> **Layout / responsiveness / spacing / scaling** are governed by a companion doc:
> **`RESPONSIVE_DESIGN_RULES.md`** (breakpoints, fluid `clamp` spacing, grid reflow 3→2→1,
> `max-w-content` = 1920, fixed right panel, button/card/table constraints, zoom behaviour).
> This file (visual identity: colour/radius/type) **overrides** any visual values there.
> Tailwind tokens added for it: `p-page` / `gap-section` / `gap-card`, `max-w-content`, `w-rpanel`, `min-w-card`.

---

## 1. Color tokens

| Token (Tailwind) | Hex | Where it goes |
|---|---|---|
| `bg-canvas` | `#fbfaf8` | Page background (every page root) |
| `text-ink` | `#111111` | All primary text, headings, numbers |
| `border-line` | `#d7d2ca` | Card / panel / table borders, dividers between cells |
| `border-line-soft` / `divide-line-soft` | `#eeeae4` | Inner row dividers inside a panel |
| `bg-lavender` | `#d7c1ff` | Soft-accent fill: **icon tiles, tags, primary buttons, rank #1, active states** |
| `text-lavender-text` | `#8d68ff` | Accent text — positive deltas, links emphasis |
| `bg-blush` / `bg-blush-soft` | `#ff91a7` / `#ff9faf` | Avatar, secondary action icon tiles |
| `bg-blush-dismiss` | `#ffd7dc` | Dismiss / danger-soft buttons & badges |
| `bg-sprout` | `#ccead2` | Success / "Enabled" badge |
| `bg-sidebar` | `#111719` | Sidebar background only |

**Status semantics** (dots & badges): success = `emerald-500`, warning = `orange-400`,
error = `red-500`, info/accent = `lavender`. Color is **never the only** signal — always pair
with a label or icon.

**Rules**
- Cards are **white** on the `canvas`. They separate by the `line` border, **not** by shadow.
- Lavender `#d7c1ff` is the ONE soft-accent. Don't introduce other purples/blues for accents.
- Min text contrast 4.5:1. Body/muted text never lighter than `ink/70`.

---

## 2. Typography

**Family:** Plus Jakarta Sans (set once via `next/font` on `<body>` in `app/layout.tsx`). No
per-page font imports. Headings use **`font-semibold` (600)** — minimal, never `font-black`.

| Role | Size / weight / tracking | Tailwind | Used for |
|---|---|---|---|
| Page title | 30px / 900 / `0.08em` / UPPERCASE | `text-[30px] font-black uppercase tracking-[0.08em]` | The H1 on every page |
| Panel / section title | 17px / 900 / `0.06em` / UPPERCASE | `text-[17px] font-black uppercase tracking-[0.06em]` | Card & panel headers |
| Stat number | 34–36px / 900 | `text-[34px] font-black leading-none` | KPI metric values |
| Card title | 18–22px / 900 | `text-[18px] font-black` / `text-[22px]` | Recommendation/cluster titles |
| Body | 13–15px / 500 | `text-[14px] font-medium` | Descriptions, list rows |
| Label (caps) | 11–13px / 900 / UPPERCASE | `text-[12px] font-black uppercase tracking-[0.08em]` | Field labels, column headers, badge text |
| Meta | 11–12px / 500 | `text-[12px]` | time-ago, ids, captions |

**Signature:** headings are **black-weight + UPPERCASE + letter-spaced**. This is the brand voice — apply it to every title.

---

## 3. Spacing, radius, motion

- **Radius:** `rounded-card` = **3px** (cards, panels, buttons), `rounded-chip` = **2px** (badges, tags, inner tiles). Avatars/platform chips = `rounded-full`. Near-square is the look — never `rounded-lg`+.
- **Borders:** always `1px` `border-line`. Flat — **no `shadow`** on cards.
- **Density:** page padding `px-[30px] py-[22px]`. Gaps between blocks `16–20px` (`gap-4`/`gap-5`). Panels: 48px header, rows ~56–62px.
- **Motion:** `transition-colors duration-200`. Hover = color/opacity shift only — never scale/layout shift.

---

## 4. Components (build pages ONLY from these)

All in `components/ui/`. Import, don't re-style ad-hoc.

### Button — `<Button variant size>`
- `primary` → `bg-lavender text-ink` (lavender fill, black text)
- `secondary` → `border border-line bg-white text-ink`
- `danger` → `bg-blush-dismiss text-ink`
- `ghost` → `text-ink hover:bg-line-soft`
- sizes `sm` / `md`. All `rounded-card font-bold`, `focus-visible:ring-2`.

### Card — `<Card>`
`rounded-card border border-line bg-white p-4`, flat. Pass `p-0` for tables/panels.

### Badge — `<Badge tone>`
`rounded-chip text-[11px] font-black uppercase`. Tones: `high`(blush) `medium`(lavender)
`low`(line-soft) `success`(sprout) `warning` `danger`(blush) `new` `info`(lavender). Use
`statusTone(status)` to map backend strings.

### IconBox — `<IconBox icon tone size>`
Soft-tinted square + ink Lucide icon. tones `lavender`(default) `blush` `sprout` `line`;
sizes `sm`(32) `md`(44) `lg`(68). Used in stat cards, quick actions, list rows.

### StatCard — `<StatCard icon label value delta caption deltaTone>`
Icon-left lavender `lg` tile, black uppercase label, 34px black number, lavender `↗` delta
(or `-` when `flat`). Place 5-up inside a single bordered row with `border-r border-line` between.

### Panel — `<Panel title badge action footer>`
Card with a 48px `border-b border-line` header (black uppercase title + optional badge/action)
and a body. The pattern for every list/table block (Sources Health, Pipeline, Activity, …).

### SectionHeader — `<SectionHeader title action>`
Standalone uppercase block label + right-side action link.

### Tags / pills
Lavender chip: `rounded-chip bg-lavender px-2 py-1 text-[12px] font-semibold`.

### Table (pattern, wrap in `overflow-x-auto`)
- Header row: `text-[10px] font-black uppercase tracking-[0.05em]`, `border-b border-line`.
- Rows: `divide-y divide-line-soft`, ~56–62px tall, hover `bg-canvas`.
- Row actions: ghost icon buttons (eye / pencil / ⋮), right-aligned.
- Always pair with `Pagination`.

---

## 5. Page skeleton (every page follows this)

```tsx
<div className="min-h-screen bg-canvas px-[30px] py-[22px] text-ink">
  <header className="mb-[22px] flex items-start justify-between">
    <div>
      <h1 className="text-[30px] font-black uppercase tracking-[0.08em] leading-none">Title</h1>
      <p className="mt-3 text-[15px]">Subtitle</p>
    </div>
    <Topbar />               {/* AI cost + clock + org switcher */}
  </header>
  {/* tabs / filters row (optional) */}
  {/* content: Cards / Panels / Table — from the kit only */}
</div>
```

Left **Sidebar** (eggplant `#111719`, lavender active pill, peach avatar) + **Topbar**
(AI-cost bar, clock, org) are global chrome in `app/(dashboard)/layout.tsx`.

---

## 6. Hard rules (a11y + polish, from ui-ux-pro-max)

- SVG icons only (**Lucide**) — never emoji as UI icons.
- `cursor-pointer` on every clickable element; visible `focus-visible:ring-2` on interactive.
- Tables wrapped in `overflow-x-auto`; images have `alt`; inputs have `<label>`.
- Transitions 150–200ms, color/opacity only; respect `prefers-reduced-motion`.
- Responsive checkpoints 375 / 768 / 1024 / 1440. No horizontal scroll on mobile.
- Next.js: Server Components by default; `'use client'` only when needed; font on `<body>` in layout.

---

## 7. Don't

- ❌ `rounded-lg`/`xl`/`2xl` on cards (kills the near-square look) — use `rounded-card`.
- ❌ `shadow-*` on cards — flat, border-only.
- ❌ cool `zinc/slate/gray` neutrals for surfaces — use warm `canvas`/`line`.
- ❌ violet-600 solid CTAs — primary is lavender `#d7c1ff` + ink text.
- ❌ medium-weight lowercase titles — titles are `font-black uppercase`.
- ❌ emoji icons, ad-hoc one-off component styling outside `components/ui/`.
