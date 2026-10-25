# Design System

This document defines the visual design system for the project — a warm editorial direction. All new components and pages **must** follow these tokens, patterns, and conventions.

---

## Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme inline` in `globals.css` — no `tailwind.config.ts`)
- **Components:** shadcn/ui (new-york style, neutral base structure, tokens overridden to the warm palette)
- **Icons:** Lucide React (app wide); Phosphor (`@phosphor-icons/react`, pinned `2.1.10`) on the landing screens only (home, record screen, meetings list), see "Landing system (home, record and meetings list)"
- **Fonts:** Geist (sans), Geist Mono (mono), Instrument Serif (display) — all via `next/font/google`
- **Dark mode:** next-themes (class-based, system default, 3-way toggle: Light / Dark / System)
- **Utilities:** `cn()` from `@/lib/utils` (clsx + tailwind-merge)

---

## Colors

All values use the **oklch** color space, defined as CSS custom properties in `globals.css` and bridged to Tailwind via `@theme inline`.

**Palette intent:** a warm arena-sand paper for the page, warm ink for text, and terracotta as the single brand accent — used sparingly (primary buttons, links, focus rings, small highlights), never as a large fill.

### Semantic Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `oklch(0.973 0.008 82)` | `oklch(0.178 0.011 52)` | Page background |
| `foreground` | `oklch(0.235 0.013 55)` | `oklch(0.952 0.008 84)` | Primary text |
| `card` | `oklch(0.992 0.004 85)` | `oklch(0.221 0.013 52)` | Card backgrounds |
| `card-foreground` | `oklch(0.235 0.013 55)` | `oklch(0.952 0.008 84)` | Card text |
| `popover` | `oklch(0.992 0.004 85)` | `oklch(0.221 0.013 52)` | Popover/dropdown bg |
| `popover-foreground` | `oklch(0.235 0.013 55)` | `oklch(0.952 0.008 84)` | Popover/dropdown text |
| `primary` | `oklch(0.552 0.128 38)` | `oklch(0.708 0.132 42)` | Buttons, links, brand accent |
| `primary-foreground` | `oklch(0.985 0.006 85)` | `oklch(0.198 0.015 46)` | Text on primary |
| `secondary` | `oklch(0.932 0.013 78)` | `oklch(0.272 0.013 52)` | Secondary buttons, subtle bg |
| `secondary-foreground` | `oklch(0.3 0.016 52)` | `oklch(0.952 0.008 84)` | Text on secondary |
| `muted` | `oklch(0.941 0.011 78)` | `oklch(0.272 0.013 52)` | Subdued backgrounds |
| `muted-foreground` | `oklch(0.512 0.019 58)` | `oklch(0.722 0.016 72)` | Subdued text, placeholders |
| `accent` | `oklch(0.921 0.029 58)` | `oklch(0.302 0.026 48)` | Hover backgrounds, highlights |
| `accent-foreground` | `oklch(0.3 0.016 52)` | `oklch(0.952 0.008 84)` | Text on accent |
| `destructive` | `oklch(0.545 0.204 27.5)` | `oklch(0.696 0.178 25)` | Error states, delete actions |
| `success` | `oklch(0.55 0.1 155)` | `oklch(0.72 0.13 158)` | Success states (e.g. "Ready" badge) |
| `border` | `oklch(0.885 0.013 72)` | `oklch(0.92 0.02 70 / 13%)` | Borders, dividers |
| `input` | `oklch(0.885 0.013 72)` | `oklch(0.92 0.02 70 / 17%)` | Input borders |
| `ring` | `oklch(0.552 0.128 38)` | `oklch(0.708 0.132 42)` | Focus rings |

### Chart Colors

| Token | Light | Dark |
|---|---|---|
| `chart-1` | `oklch(0.552 0.128 38)` | `oklch(0.708 0.132 42)` |
| `chart-2` | `oklch(0.62 0.085 62)` | `oklch(0.75 0.09 68)` |
| `chart-3` | `oklch(0.55 0.1 155)` | `oklch(0.72 0.13 158)` |
| `chart-4` | `oklch(0.7 0.11 82)` | `oklch(0.8 0.11 85)` |
| `chart-5` | `oklch(0.45 0.07 30)` | `oklch(0.62 0.1 22)` |

### Sidebar Colors

| Token | Light | Dark |
|---|---|---|
| `sidebar` | `oklch(0.955 0.01 80)` | `oklch(0.198 0.012 52)` |
| `sidebar-foreground` | `oklch(0.235 0.013 55)` | `oklch(0.952 0.008 84)` |
| `sidebar-primary` | `oklch(0.552 0.128 38)` | `oklch(0.708 0.132 42)` |
| `sidebar-primary-foreground` | `oklch(0.985 0.006 85)` | `oklch(0.198 0.015 46)` |
| `sidebar-accent` | `oklch(0.921 0.029 58)` | `oklch(0.302 0.026 48)` |
| `sidebar-accent-foreground` | `oklch(0.3 0.016 52)` | `oklch(0.952 0.008 84)` |
| `sidebar-border` | `oklch(0.885 0.013 72)` | `oklch(0.92 0.02 70 / 13%)` |
| `sidebar-ring` | `oklch(0.552 0.128 38)` | `oklch(0.708 0.132 42)` |

### Fixed-Color Exception

The Google "G" mark (`GoogleMark` in `google-sign-in-button.tsx`) uses Google's fixed brand colors (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) instead of tokens — a deliberate, documented exception because the mark's colors are fixed by Google's identity guidelines. It sits in a white chip (`bg-white`) so it stays legible on the terracotta button.

---

## Typography

### Three Families, Three Jobs

| Token / class | Font | Usage |
|---|---|---|
| `font-sans` (default, `--font-geist-sans`) | Geist | All UI body text — the default on `<body>` |
| `font-mono` (`--font-geist-mono`) | Geist Mono | Timestamps, durations, dates, counts, prices, step numbers — anything numeric/tabular. Pair with `tabular-nums`. |
| `font-display` (`.font-display`, `--font-instrument-serif`) | Instrument Serif | Large headings and markdown titles only |

**`font-display` rule:** weight 400, `letter-spacing: -0.015em`, falls back to Georgia/serif. Used for `h1`/`h2` page and section headings (`text-2xl` and up), `CardTitle`, and markdown `h1`/`h2` inside the AI summary prose. **Never** used for body text, buttons, labels, badges, or anything small — those stay on `font-sans`.

**`font-mono` rule:** used for dates (`<time>` elements), durations (`12:34`), the recorder's stopwatch, audio-part selectors, segment timestamps, prices (`usd()` helper), meeting counts, the `404`/`Error` eyebrow label, and step numbers (`01`, `02`, `03` on the homepage). Always combined with `tabular-nums` where digits shift.

### Observed Type Scale

| Class | Usage |
|---|---|
| `text-[0.6875rem]` | `.eyebrow` label, markdown `h3` (section label), speaker labels |
| `text-xs` | Helper text, footer, timestamps, badges |
| `text-sm` | Body copy, descriptions, labels, list metadata |
| `text-[0.9375rem]` | Reading prose (summary, transcript segments) |
| `text-base` | Form descriptions, auth subheading |
| `text-lg` | Dialog titles |
| `text-2xl` | Card titles, section headings (`font-display`) |
| `text-3xl` | Sub-page headings, error/loading headings (`font-display`) |
| `text-4xl` | Page h1 on secondary pages (`font-display`) |
| `text-5xl` | Page h1 on primary pages / hero on small screens (`font-display`) |
| `text-6xl` | "My meetings" h1 on `sm+` (`font-display`) |
| `text-7xl` / `text-8xl` | Homepage hero h1 on `sm+` / `lg+` (`font-display`) |

### Weights & Tracking

| Class | Usage |
|---|---|
| `font-medium` | Buttons, form labels, list item titles |
| `font-semibold` | `strong` in markdown prose |
| `.eyebrow` | `text-muted-foreground text-[0.6875rem] font-medium tracking-[0.18em] uppercase` — a small-caps label sitting above a heading |
| `tracking-tight` / `tracking-[-0.015em]` | Hero/display text (built into `.font-display`) |
| `tracking-widest` | Keyboard/dropdown shortcuts |

### Line Heights

`leading-[0.95]` (hero h1), `leading-[1.05]`/`leading-[1.1]` (page h1), `leading-tight`/`leading-snug` (headings), `leading-6`/`leading-7`/`leading-8` (body/paragraphs), `leading-none` (labels).

---

## Custom Utilities (`@layer utilities` in `globals.css`)

| Class | What it does | When to use |
|---|---|---|
| `.font-display` | Applies Instrument Serif, weight 400, `letter-spacing: -0.015em`, Georgia fallback | Large headings, markdown h1/h2 — see Typography |
| `.eyebrow` | Small-caps label: `text-muted-foreground text-[0.6875rem] font-medium tracking-[0.18em] uppercase` | Sits above a page or section heading on editorial pages ("Sign in") |
| `.glow-bg` | Two soft radial gradients (top-center in `primary`, upper-right in `chart-2`) bleeding into the page background | Wraps full-bleed page sections: homepage, meeting list, meeting detail, 404, error |
| `.auth-bg` | A single soft radial gradient in `primary`, centered at the top | Wraps the `(auth)` layout only |
| `.rule-fade` | `linear-gradient` hairline that fades to transparent at both ends (`to right, transparent, border 15%, border 85%, transparent`) | Divider between a header and its content, or between sections — used instead of a plain `<hr>`/`Separator` on editorial pages |
| `.card-interactive` | `transition-[transform,box-shadow,border-color] duration-300 ease-out`; on hover: `border-primary/30 -translate-y-0.5` + a soft custom drop shadow | Interactive cards that lift on hover |

### Animations

| Class | Keyframe effect | Duration / easing |
|---|---|---|
| `animate-fade-in` | opacity 0 → 1 | 0.3s ease-out |
| `animate-fade-up` | opacity 0 → 1, `translateY(12px → 0)` | 0.5s `cubic-bezier(0.16, 1, 0.3, 1)`, `both` |
| `animate-scale-in` | opacity 0 → 1, `scale(0.97 → 1)` | 0.2s ease-out |
| `animate-pulse-ring` | expanding `box-shadow` ring in `destructive`, fading to transparent | 2s ease-out infinite |

**Entrance stagger pattern:** sections use `animate-fade-up` combined with an arbitrary `[animation-delay:NNNms]` property, e.g. `className="animate-fade-up [animation-delay:120ms]"`. This ordering (named utility first, arbitrary property second) matters because Tailwind v4 emits arbitrary properties **after** named utilities in the generated stylesheet, so the delay is guaranteed to win regardless of source order elsewhere. Stagger values observed: `80ms`, `120ms`, `220ms`, `300ms`.

`animate-pulse-ring` is also used directly on small dots (e.g. the "Recording" status dot) rather than only through a wrapping utility.

---

## Border Radius

| Token | Value | Class |
|---|---|---|
| `--radius` | `0.75rem` (12px) | Base |
| `--radius-sm` | `calc(--radius - 4px)` = 8px | `rounded-sm` |
| `--radius-md` | `calc(--radius - 2px)` = 10px | `rounded-md` |
| `--radius-lg` | `var(--radius)` = 12px | `rounded-lg` |
| `--radius-xl` | `calc(--radius + 4px)` = 16px | `rounded-xl` |
| `--radius-2xl` | `calc(--radius + 10px)` = 22px | `rounded-2xl` |
| — | 9999px | `rounded-full` |

**Usage:**
- `rounded-full` — **Button** (all variants/sizes except `icon`), badges, avatars, header logo chip, icon-only pills, search input on the meeting list
- `rounded-lg` — Button `icon` size, header logo container, header dropdown items
- `rounded-xl` — Card, Dialog, dropdown menu content, empty-state icon circle background container, list row icon chip
- `rounded-2xl` — Larger content cards/sections (summary card, processing card, recorder card, empty-state dashed panel)
- `rounded-md` — Input, textarea, code, dropdown separator corners

---

## Shadows

| Usage | Value |
|---|---|
| Card base | Custom: `shadow-[0_1px_2px_0_color-mix(in_oklch,var(--foreground)_6%,transparent)]` (subtle, tinted by foreground, not a flat gray) |
| `.card-interactive` hover | Custom: `box-shadow: 0 10px 30px -16px color-mix(in oklch, var(--foreground) 40%, transparent)` |
| Buttons, inputs, textarea | `shadow-xs` (Tailwind default) |
| Dropdown/dialog content | `shadow-md` / `shadow-lg` (Tailwind default) |

Card shadows are `color-mix`-based (tinted by the `foreground` token) rather than flat Tailwind grays — this keeps them warm in both themes.

---

## Spacing & Layout

### Page wrapper pattern

Full-bleed editorial pages are **not** wrapped in the plain `container mx-auto px-4` pattern from the old system. Instead:

```
<div className="glow-bg">              (or .auth-bg for the auth layout)
  <div className="mx-auto max-w-{N} px-4 pt-{N} pb-{N} sm:px-6 sm:pt-{N} sm:pb-{N}">
    ...
  </div>
</div>
```

### Max Widths (observed)

| Class | Usage |
|---|---|
| `max-w-md` | Auth card wrapper, 404/error content |
| `max-w-2xl` | New meeting page (landing system) |
| `max-w-3xl` | Homepage hero copy block |
| `max-w-4xl` | Meeting detail page |
| `max-w-5xl` | Meeting list page (landing system) |
| `max-w-6xl` | Homepage, site header, site footer |

### Page Header Pattern

```
<header className="animate-fade-up flex flex-col gap-3 (or justify-between for list pages)">
  <p className="eyebrow">Section label</p>
  <h1 className="font-display text-4xl sm:text-5xl leading-[1.1]">Page title</h1>
  <p className="text-muted-foreground text-sm sm:text-base leading-6">Subcopy</p>
</header>
<div className="rule-fade mt-10 sm:mt-14 h-px" />
```

### List Row Pattern (editorial)

The meeting list itself now uses landing cards (see "Landing system", signed in screens); keep this pattern for editorial lists only.

```
<ul className="border-border/70 divide-y border-y">
  <li><Link className="group hover:bg-accent/40 -mx-3 flex items-center gap-3 rounded-lg px-3 py-5 transition-colors">
    <div className="bg-muted group-hover:bg-primary/10 size-10 rounded-lg">...icon...</div>
    <div className="min-w-0 flex-1">...title + font-mono meta...</div>
    <Badge variant={...}>...</Badge>
    <ArrowUpRight className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </Link></li>
</ul>
```

### Empty State Pattern

Dashed border, `rounded-2xl`, centered icon in a `rounded-full bg-muted` chip, `font-display` heading, `text-muted-foreground` body, optional CTA button:

```
<div className="border-border/70 flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-16 text-center sm:py-24">
  <span className="bg-muted flex size-14 items-center justify-center rounded-full"><Icon /></span>
  <h2 className="font-display text-2xl sm:text-3xl">...</h2>
  <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-6">...</p>
  <Button asChild size="lg">...</Button>
</div>
```

### Error State Pattern

Two forms observed:
1. **Full page** (`not-found.tsx`, `error.tsx`): `.glow-bg` wrapper, centered `max-w-md`, `font-mono text-xs` eyebrow ("404"/"Error"), `font-display text-4xl sm:text-5xl` heading, muted body, one or two `size="lg"` buttons.
2. **Inline alert** (form/section errors): `role="alert"`, tinted border+background at low opacity — `border-destructive/25 bg-destructive/5` (or `/10`, `/8` depending on context) with a `TriangleAlert` icon plus text, never color alone.

### Skeleton Pattern

`Skeleton` (`bg-accent animate-pulse rounded-md`) shapes are composed to mirror the real layout (e.g. row: `size-10 rounded-lg` icon + two text-line bars + a `rounded-full` badge-shaped bar), wrapped in a container with `role="status" aria-busy="true"`.

### Grid Patterns

| Pattern | Usage |
|---|---|
| `grid md:grid-cols-3` with bordered/divided columns | Homepage "how it works" steps |
| `grid gap-2.5 sm:grid-cols-2` of `has-[:checked]:` styled label cards | Recorder audio-source picker |

### Responsive Breakpoints

Standard Tailwind breakpoints — `sm:` (640px) for padding/type-size steps, `md:` (768px) for column changes, `lg:`/`sm:` further steps on hero type.

---

## Icons

**Library:** Lucide React

### Sizing Convention

| Size | Classes | Usage |
|---|---|---|
| XS | `size-3` | Badge inline icons (e.g. inside `Badge`) |
| SM | `size-3.5` | Google mark, small inline icons |
| Default | `size-4` (implicit via `[&_svg:not([class*='size-'])]:size-4` on Button) | Standard UI icons, button icons |
| MD | `size-5` | Section heading icons, empty-state alert icon |
| LG | `size-6` | Empty-state search/mic icon circle |
| XL | — | No oversized (`h-16`) illustration icons observed; empty states use `size-14` circular chips instead |

### Icons in use

`Mic`, `Square`, `Monitor`, `UploadCloud`, `Download`, `ShieldCheck`, `AudioLines`, `AppWindow`, `Search`, `Plus`, `ArrowUpRight`, `ArrowLeft`, `TriangleAlert`, `RotateCcw`, `Pencil`, `Trash2`, `Check`, `ChevronDown`, `Loader2`, `Wind` (logo mark), `NotebookPen`, `LogOut`, `FileText`.

---

## Components (shadcn/ui, `src/components/ui/`)

### Button

`rounded-full` base (not `rounded-md`). 6 variants, 4 sizes (CVA-based). `active:scale-[0.98]` on press.

| Variant | Usage |
|---|---|
| `default` | Primary actions — `bg-primary` |
| `destructive` | Delete/danger — `bg-destructive text-white` |
| `outline` | Tertiary — `border bg-background`, `dark:bg-input/30` |
| `secondary` | Secondary actions — `bg-secondary` |
| `ghost` | Subtle/icon actions |
| `link` | Inline text link |

| Size | Height | Padding | Notes |
|---|---|---|---|
| `sm` | h-8 | px-3.5 | `gap-1.5` |
| `default` | h-10 | px-5 | `has-[>svg]:px-4` |
| `lg` | h-12 | px-7 | `text-[0.9375rem]` |
| `icon` | size-9 | — | Only size that is `rounded-lg`, not `rounded-full` |

### Card

`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

Base: `rounded-xl border bg-card text-card-foreground` + custom color-mix shadow (see Shadows). `CardTitle` is `font-display text-2xl leading-tight tracking-tight` (serif, not the old `font-semibold` sans title).

### Input

`h-9 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs`, focus via `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`, `aria-invalid:border-destructive`. Pages frequently override height/radius per context (e.g. `h-11 rounded-lg` on the search box).

### Badge

5 variants now — **`success` is new**:

| Variant | Style |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `destructive` | `border-destructive/25 bg-destructive/12 text-destructive` (tinted, not solid) |
| `success` | `border-success/25 bg-success/12 text-success` |
| `outline` | `text-muted-foreground` |

Base: `rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide` with `[&>svg]:size-3`. Used with a leading `animate-pulse-ring` dot for the "Recording" state, and a `Loader2` spin icon for "processing" — status is never color-only.

### Dialog

Radix-based. Overlay `bg-black/50`. Content: `rounded-lg border p-6 shadow-lg`, `sm:max-w-lg`, fade + zoom (`zoom-in-95`/`zoom-out-95`) animations. `DialogTitle` is plain `text-lg font-semibold` (not display serif).

### DropdownMenu

Radix-based. Content: `rounded-md border p-1 shadow-md min-w-[8rem]`. Items support a `data-variant="destructive"` state. Consumers may override radius/padding on `DropdownMenuContent` (user menu uses `rounded-xl p-1.5`).

### Avatar

`size-8` default (`Avatar`, `AvatarImage`, `AvatarFallback`), `rounded-full`. User menu overrides to `size-9 border border-border`. Fallback shows the first letter of the user's name on `bg-muted`/`bg-secondary`.

### Separator

`bg-border`, `h-[1px] w-full` (horizontal) or `h-full w-[1px]` (vertical). Editorial pages generally prefer `.rule-fade` over `Separator` for section breaks; `Separator`/`DropdownMenuSeparator` remain for menu/form dividers.

### Spinner

`Loader2` + `animate-spin text-muted-foreground`. Sizes: `sm` (h-4 w-4), `md` (h-6 w-6, default), `lg` (h-8 w-8).

### Skeleton

`bg-accent animate-pulse rounded-md` (uses `accent`, not `muted`, as its base tone).

### Toast (Sonner)

Custom icons per state (`CircleCheckIcon`, `InfoIcon`, `TriangleAlertIcon`, `OctagonXIcon`, `Loader2Icon`). Theme follows `next-themes`. CSS variable overrides: `--normal-bg: var(--popover)`, `--normal-text: var(--popover-foreground)`, `--normal-border: var(--border)`, `--border-radius: var(--radius)`.

---

## Accessibility & Motion

- **Reduced motion guard (global, `globals.css` `@layer base`):**
  ```css
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
  This is global and automatic — no per-component opt-in needed.
- **Focus ring (global):** `:focus-visible { @apply outline-ring outline-2 outline-offset-2; }`. Interactive primitives (Input, Button, etc.) additionally use `focus-visible:ring-ring/50 focus-visible:ring-[3px]`.
- **Selection color:** `::selection` tinted with `color-mix(in oklch, var(--primary) 22%, transparent)`.
- **One `h1` per page:** every page (`page.tsx`, `login/page.tsx`, `not-found.tsx`, `error.tsx`, `meeting-list.tsx`, `meeting-detail.tsx`, `new-meeting.tsx`) renders exactly one `<h1>`; section headings within a page use `<h2>`.
- **Skip link:** `SiteHeader` renders a `sr-only focus:not-sr-only` "Skip to content" link targeting `#main-content`.
- **Status is never color-only:** badges pair color with an icon (pulsing dot for recording, spinner for processing) and a text label; error alerts always carry a `TriangleAlert` icon and text alongside the destructive tint; `role="alert"`/`role="status"`/`aria-live`/`aria-busy` are used throughout loading and error states.

---

## Dark Mode

- **Method:** Class-based via `next-themes`, `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
- **Toggle:** `ModeToggle` in the header (3-way: Light / Dark / System).
- All semantic tokens swap under the `.dark` selector in `globals.css` — the same warm hue family, shifted darker/desaturated ("the same paper, lit by lamplight rather than daylight," per the file's own comment).
- **Rule:** components must consume semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) only. No hard-coded hex/gray values, except the documented Google-mark exception above.

---

## Landing system (home, record and meetings list)

These screens deliberately do **not** follow the warm editorial system above. They follow the vendored landing skill (`.claude/skills/landing-page-design/SKILL.md`, Part B):

- **Home:** `src/app/page.tsx`, `src/components/home/*` (public, with its own island nav).
- **Record screen:** `/meetings` (`src/app/meetings/page.tsx`) and `/meetings/new` (`new-meeting.tsx`, `meeting-recorder.tsx`, `native-meeting-recorder.tsx`), in every state: idle, starting, recording, saving, stopped, errors, recovery, upload, and the Android native recorder.
- **Meetings list:** `/meetings/history` (`meeting-list.tsx`): search, list, empty, loading and error states.
- **Meeting tabs:** `meeting-navigation.tsx` uses the landing style on those three routes and keeps the editorial style on meeting detail.

Everything else (meeting detail, share pages, admin, auth pages, Android page, footer, and the standard `SiteHeader`) still follows the warm editorial system. The record screen and meetings list keep the shared `SiteHeader`; only the home replaces it with the island nav (below). Do not copy landing patterns into other app screens, and do not use editorial utilities (`font-display`, `.eyebrow`, `.glow-bg`, `.rule-fade`, `animate-fade-up`) on landing screens.

### Scope and tokens

Every landing screen sits inside a `.landing` wrapper defined in `globals.css` (outside `@layer`, after the utilities). It re-points semantic tokens, so primitives rendered there resolve to landing surfaces:

| Token | Light | Dark |
|---|---|---|
| `--background` (page) | unchanged warm paper (flat) | `#131209` |
| `--card` / `--popover` | unchanged | `#1F1F1F` |
| `--muted` / `--secondary` | unchanged | `#272727` |
| `--accent` (hover surfaces) | unchanged | `#313131` |
| `--landing-heading-from` → `--landing-heading-to` | `#000000` → `#666666` | `#FFFFFF` → `#9B9B9B` |
| `--landing-band` (`bg-band` utility) | `oklch(0.948 0.011 78)` | `#181818` |
| `--radius` | `0.5rem` | `0.5rem` |

- **Token scope:** the same tokens are also set on `.landing-island` for landing UI that renders outside `.landing`: the home header (root layout) and the meeting tabs (meetings layout). Only `.landing` paints a background.
- **Dark backgrounds** may only use `#000000`, `#181818`, `#1F1F1F`, `#272727`, `#313131`, `#131209`. `.dark body:has(.landing)` paints the canvas `#131209` so the shared header and footer sit on the same surface. On landing screens `.site-header` also re-points `--background` to `#131209` in dark mode so its translucent glass does not show a lighter band, and inside the APK the reserved status bar strip (`.app-frame[data-native-android]::before`) does the same.
- **Primary** stays the terracotta `primary` token: CTA, labels, icon chips, small highlights.
- **Radius:** with `--radius: 0.5rem` the project scale equals Tailwind's defaults (`sm` 4px, `md` 6px, `lg` 8px, `xl` 12px); `rounded-2xl` would be 18px, so the home uses `rounded-3xl` (24px) for large cards and `rounded-4xl` (32px) for the two framed moments (the product demo bezel and the final CTA panel). Nested shapes follow `inner = outer − gap` when the gap is under 32px and the result is above 2px.
- **Flat surfaces:** no background gradients, no `.glow-bg`, no single sided borders (cards are fully bordered or not at all; dividers inside the demo are `h-px bg-border` rules or surface changes).

### Hero heading gradient

`.text-heading-gradient` (in `@layer utilities`) clips a left to right `linear-gradient(var(--landing-heading-from), var(--landing-heading-to))` to the text. It is the only gradient on the home, used only on the hero `h1`, and falls back to `CanvasText` under `forced-colors`. Hero heading and subheading are capped at `max-w-170` (680px), with each sentence on its own block line so breaks follow the thought.

### Type and copy

- Geist only. No `font-display`, no italics, weights up to `font-semibold`. Geist Mono only for numeric UI (step numbers, timestamps, the demo stopwatch).
- Tailwind type steps only, no `text-[…]`. Section label (the home's eyebrow) is `text-primary text-sm font-semibold`, sentence case. Line height comes from the step; only `tracking-tight` is added on large headings.
- `text-balance` on headings, `text-pretty` on body copy.
- Copy: sentence case, no hyphens or dashes inside sentences, no AI cliches, CTA is a verb plus what you get ("Record your first meeting"). Only state facts true of the product; no invented testimonials, logos or numbers.

### Spacing and buttons

Padding, margin and gap only from `0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24` (Tailwind units). The primary CTA (`HomeCta`, wrapping the shared `GoogleSignInButton` through its `label`, `className` and `buttonClassName` props) is `text-base font-semibold`, `py-2`, with the Google chip inset `pl-2` so it sits concentric with the pill (`pr-4` for optical balance). The same CTA renders at the top and bottom of the page.

### Icons

Phosphor, imported from `@phosphor-icons/react/dist/ssr` using the `…Icon` export names (works in server and client components); the `Icon` type comes from `@phosphor-icons/react` as a type only import. Landing screens only; Lucide stays everywhere else.

### Motion

- Curve: `--ease-fluid: cubic-bezier(0.32, 0.72, 0, 1)` (`ease-fluid` utility). Reveals and transforms run 700 to 1000ms; hover colour shifts 300ms on the same curve. Tick driven progress bars in the demo stay `ease-linear` on purpose.
- `animate-landing-rise` (1000ms, fade up with blur) staggers the hero in on load via `[animation-delay:NNms]`; `animate-landing-fade` (700ms) switches demo scenes.
- `Reveal` (`src/components/home/reveal.tsx`): IntersectionObserver scroll reveal, `translate-y-16 blur-md opacity-0` to visible over 1000ms. It only hides content from its effect via `data-reveal`, skips anything already on screen at mount, and does nothing without IntersectionObserver or under reduced motion, so content is always visible without JS.
- `TaglineReveal` (`src/components/home/tagline-reveal.tsx`): the mandatory large tagline section. Words start at `text-foreground/30` and light one at a time in reading order (70ms apart) as they cross a trigger line at 65% of the viewport, one IntersectionObserver over the words, never a scroll listener. Same progressive enhancement rules as `Reveal`.
- The global reduced motion guard still applies.

### Island nav (home header)

`src/components/home/island-nav.tsx`, chosen over `SiteHeader` by `HeaderSwitch` (`src/components/header-switch.tsx`, client) when `usePathname() === "/"`. The pathname is identical on the server and during hydration, so there is no mismatch or header swap after load. The home always renders signed out (signed in visitors are redirected to `/meetings`).

- **Closed:** a sticky (`top-0`), pointer transparent `<header class="island-nav landing-island">` holding a glass pill: `mt-6 mx-auto w-max rounded-full border border-foreground/10 bg-background/70 backdrop-blur-xl p-2` with a soft foreground tinted shadow. Contents: logo (Phosphor `WindIcon` in a primary circle plus Geist "breeze"), then from `sm` a hairline divider, a one tap light/dark button and a quiet ghost "Sign in" link, then the menu button. On phones the pill is logo plus menu button only. The page's single primary action stays the hero CTA.
- **Menu button:** two `h-0.5 w-4` lines absolutely positioned at `-translate-y-1` / `translate-y-1`; open, both go to `translate-y-0` and turn `rotate-45` / `-rotate-45` into an X (700ms `ease-fluid`). `aria-expanded`, `aria-controls`, label "Open menu" / "Close menu".
- **Overlay:** `fixed inset-0`, `bg-white/80 dark:bg-black/80 backdrop-blur-3xl` (the skill's literal white/black glass; the only non token colours on the home besides the Google mark), `role="dialog" aria-modal`, `inert` and `opacity-0 pointer-events-none` while closed. Items: Sign in, Android app ("Update Android app" inside the native app), How it works (`#how-it-works`), Questions (`#faq`) as `text-4xl font-semibold` rows, then a Light / Dark / System radio group. Each row rises from `translate-y-12 opacity-0` with `delay-100`, `delay-150`, `delay-200`… while opening; closing drops the delays.
- **Behaviour:** opening locks page scroll (`overflow: hidden` on `<html>` plus scrollbar width padding), focuses the first link and traps Tab inside the header; Escape closes and returns focus to the menu button; any link closes it. Section links close first, then scroll, focus the section (`tabIndex={-1}`, `scroll-mt-24`) and set the hash. The global reduced motion guard collapses all of it to instant changes.
- **Skip link** is rendered by the island too and targets `#main-content`, like `SiteHeader`.
- **Android WebView:** inside `NativeAppFrame`, `.island-nav` gets the same `top: var(--native-top-inset)` as `.site-header`, and `.island-menu` adds the inset to its top padding (see `docs/android.md`).

### Section rhythm and surfaces

Sections alternate between the page background and the flat `bg-band` surface, and vary their layout so the page never reads as a stack of identical cards:

1. **Hero** on the page background. `h1` steps to `text-6xl` from `sm`. The product demo sits in a wide `max-w-6xl` column, framed by a translucent `rounded-4xl` bezel (`bg-card/60 p-2`, large foreground tinted shadow) around the `rounded-3xl` window, and straddles a `bg-band` block that fills the lower half, so it bridges into the next section.
2. **Problem to solution** on the band: heading on the left (5 of 12 columns), a layered comparison on the right. "Without Breeze" is a receding dashed outline card in muted text; "With Breeze" overlaps it (`-mt-10 sm:ml-12`) as a solid `bg-primary text-primary-foreground` card with a primary tinted shadow. This is the one large primary fill on the home.
3. **Benefits** on the page background as a bento (`lg:grid-cols-6`: 4 + 2, then 2 + 2 + 2; two columns from `sm`). Each card is `rounded-3xl p-3` around a `rounded-xl bg-band` well holding a product vignette, with the title and copy below.
4. **How it works** on the band as an open timeline: icon circle plus hairline, a faint `font-mono text-5xl` step number, title and copy. No cards.
5. **Tagline reveal** on the page background with a primary logo mark above it.
6. **FAQ** on the band, heading sticky on the left from `lg`, answers on the right.
7. **Final CTA** on the page background in a `rounded-4xl` card: label, `text-5xl` heading, one line of copy, the three reassurances (bordered chips from `sm`, plain rows on phones), then the same CTA as the hero.

### Benefit vignettes

`src/components/home/benefit-visuals.tsx` holds five static, `aria-hidden` mini UIs built in JSX (no images), reusing ProductDemo's fictional meeting (Q3 launch planning on Sep 29, 2026, 43 min; Maya, Daniel, Priya) and showing only what the app does:

| Vignette | Shows | Backed by |
|---|---|---|
| `SummaryVisual` | Decisions, Next steps (owners), Open questions & risks | Summary prompt sections in `src/lib/meetings.ts` |
| `SpeakersVisual` | Renaming "S2" to Daniel; transcript lines labelled by name | Speakers section in `meeting-detail.tsx` |
| `NoteVisual` | "Notes for the AI" with a live `n/2000` count and "Process meeting" | AI context form (2000 character limit) |
| `ShareVisual` | "Anyone with the link", view only link, "AI summary" / "Transcript" checkboxes | Share dialog "Shared sections" |
| `SearchVisual` | Search for "rollback" with the match highlighted in each excerpt | Meeting list search and `Highlight` |

Vignettes use `bg-card rounded-lg border shadow-xs` surfaces, Tailwind type steps, Phosphor icons and semantic tokens only. Keep their content consistent with the demo and true to the product when either changes.

### Structure and SEO

Island nav, hero (label, gradient `h1`, subheading, CTA, one factual proof line, `ProductDemo`), problem to solution, five benefits (bento with vignettes), three steps (`#how-it-works`), tagline reveal, FAQ (`#faq`, native `<details>`), risk reversal with the final CTA. The FAQ array in `src/components/home/faq.tsx` feeds both the visible list and the `FAQPage` JSON-LD. The page sets its own title and description.


### Signed in landing screens (record and meetings list)

The same tokens, type, spacing, icon and motion rules as the home, applied to working screens. No hero gradient, no `Reveal`/`TaglineReveal` (content is above the fold or dynamic); entrance is `animate-landing-rise` with `[animation-delay:80ms|120ms|160ms]` staggers.

- **Wrapper:** each page renders `<div className="landing">` itself (not the meetings layout), so meeting detail stays editorial. Page widths: `/meetings` full width centered, `/meetings/new` `max-w-2xl`, `/meetings/history` `max-w-5xl`.
- **Page header:** label `text-primary text-sm font-semibold`, `h1` `text-4xl sm:text-5xl font-semibold tracking-tight text-balance`, subcopy `text-muted-foreground text-base text-pretty`. No `.rule-fade` under it.
- **Meeting tabs:** a `bg-card border-foreground/10 rounded-full border p-1 shadow-xs` track; each tab `rounded-full px-4 py-2 text-sm font-semibold` with a Phosphor icon. The current tab inverts (`bg-foreground text-background`, filled icon, `aria-current="page"`); the other is muted with a `hover:bg-accent` shift.
- **Record button (`/meetings`):** the hero and the only primary action. A `bg-primary` circle (`w-52 sm:w-60`, filled `MicrophoneIcon` plus "Record" in `text-lg font-semibold`) inside a translucent `bg-card/60 border-foreground/10 rounded-full border p-3` bezel with a foreground tinted shadow, echoing the home's demo bezel. Hover `scale-[1.02]` and a deeper primary shadow, active `scale-[0.98]`, `focus-visible:ring-4`, all `ease-fluid duration-300`. The page `h1` stays `sr-only`. Below it: one calm line of copy and "Upload a recording" as a bordered `bg-card` pill (secondary).
- **Recorder card:** `bg-card rounded-3xl border p-3 shadow-xs` around a `rounded-xl` clock well (24px outer, 12px gap: 12px inner). The well is `bg-band` at rest and tints `bg-destructive/8` while recording or `bg-primary/8` while saving. A bordered status pill names the state in text (Standing by, Getting ready, Recording, Saving, Stopped) with a dot (`animate-pulse-ring` while recording) or a spinning `CircleNotchIcon`; status is never color only. The timer is `font-mono text-5xl sm:text-6xl tabular-nums`. Main buttons are `h-14 w-full text-base font-semibold` pills with `hover:-translate-y-0.5`.
- **Disclosures:** `<details>` stay native; the `summary` is a `rounded-xl px-3 py-3 text-sm font-semibold` row with a leading icon, `hover:bg-accent`, a focus ring and a `CaretDownIcon` that rotates when open (`group-open/<name>:rotate-180`). Upload and "Saved on this phone" are their own `rounded-3xl p-3` cards; list items inside them sit on `bg-band rounded-xl` wells.
- **Alerts:** `rounded-xl border border-destructive/25 bg-destructive/5 text-destructive` with a `WarningIcon` (or `PhoneSlashIcon` for the call notice) and text.
- **Meeting list rows:** each meeting is a fully bordered card, never a divided list: `bg-card rounded-3xl border p-3 shadow-xs`, a `size-12 rounded-xl bg-band` icon well from `sm` (hidden on phones to give titles room), title `text-base font-semibold truncate`, then date and duration in `font-mono text-xs tabular-nums` with the status badge beside them. Badges pair an icon with text: `CheckCircleIcon` Ready, `SparkleIcon` Ready to process, spinning `CircleNotchIcon` Preparing, pulsing dot Recording, `WarningIcon` Needs attention. Hover lifts the card (`-translate-y-0.5`, `hover:border-foreground/20`, a soft foreground tinted shadow, `ease-fluid duration-500`) and nudges the `ArrowUpRightIcon`.
- **Search:** `h-12 rounded-full bg-card` input with a `MagnifyingGlassIcon`; counts sit beside it in `font-mono text-xs`.
- **Loading:** skeleton cards with the same shape as a row (well, two text bars, a badge pill), `role="status" aria-busy="true"`. The recorder shows a skeleton of the clock card while it detects the Android bridge.
- **Empty:** a dashed `bg-card rounded-3xl border border-dashed` panel, `size-12 rounded-full bg-primary/10 text-primary` icon chip, `text-2xl sm:text-3xl font-semibold` heading and a "Record a meeting" primary pill.
