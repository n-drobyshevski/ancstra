# Design System — Ancstra

Foundation tokens and specifications for the Ancstra UI. Built on Tailwind CSS v4 (CSS-first configuration) with OKLCH color space and shadcn/ui components. **Indigo Heritage** palette (updated 2026-03-22). See [Style Philosophy](style-philosophy.md) for design direction.

---

## Color Palette (OKLCH)

Tailwind CSS v4 uses CSS custom properties. All colors defined in OKLCH for perceptual uniformity.

### Core Tokens (Light Mode)

```css
:root {
  /* Primary — Warm indigo-blue (Indigo Heritage palette, updated 2026-03-22) */
  --primary: oklch(0.50 0.14 265);
  --primary-foreground: oklch(0.98 0.005 265);

  /* Secondary — Muted sage green */
  --secondary: oklch(0.62 0.07 160);
  --secondary-foreground: oklch(0.98 0.005 160);

  /* Accent — Burnished gold */
  --accent: oklch(0.72 0.13 60);
  --accent-foreground: oklch(0.20 0.02 60);

  /* Destructive — Red (delete, errors) */
  --destructive: oklch(0.55 0.20 25);
  --destructive-foreground: oklch(0.98 0.005 25);

  /* Surfaces */
  --background: oklch(0.98 0.005 250);
  --card: oklch(1.0 0 0);
  --popover: oklch(1.0 0 0);
  --muted: oklch(0.95 0.005 250);

  /* Text */
  --foreground: oklch(0.15 0.01 250);
  --card-foreground: oklch(0.15 0.01 250);
  --muted-foreground: oklch(0.55 0.01 250);

  /* Borders */
  --border: oklch(0.90 0.005 250);
  --input: oklch(0.90 0.005 250);
  --ring: oklch(0.50 0.14 265);

  /* Sidebar (shadcn sidebar component) */
  --sidebar-background: oklch(0.97 0.005 250);
  --sidebar-foreground: oklch(0.25 0.01 250);
  --sidebar-accent: oklch(0.93 0.01 250);
}
```

### Genealogy-Specific Semantic Colors

```css
:root {
  /* Sex indicators */
  --sex-male: oklch(0.60 0.12 240);
  --sex-female: oklch(0.65 0.12 340);
  --sex-unknown: oklch(0.70 0.05 250);

  /* Validation statuses */
  --status-confirmed: oklch(0.55 0.15 150);
  --status-proposed: oklch(0.60 0.15 250);
  --status-disputed: oklch(0.65 0.15 80);

  /* Relationship lines on tree */
  --line-confirmed: oklch(0.40 0.05 250);    /* solid */
  --line-proposed: oklch(0.60 0.10 250);     /* dashed */
  --line-disputed: oklch(0.60 0.12 80);      /* dotted */

  /* Completion indicator */
  --completion-low: oklch(0.60 0.15 25);     /* red, <25% */
  --completion-medium: oklch(0.65 0.15 80);  /* amber, 25-75% */
  --completion-high: oklch(0.55 0.15 150);   /* green, >75% */

  /* Living person indicator */
  --living-badge: oklch(0.55 0.15 150);
}
```

### Dark Mode (Soft Dusk)

Applied via `.dark` class (next-themes, `attribute="class"`).

```css
.dark {
  /* Interactive (reconciled from design-system.md spec) */
  --primary: oklch(0.70 0.12 265);
  --primary-foreground: oklch(0.15 0.02 265);
  --secondary: oklch(0.50 0.07 160);
  --secondary-foreground: oklch(0.90 0.005 160);
  --accent: oklch(0.28 0.03 265);        /* surface accent for hover states */
  --accent-foreground: oklch(0.88 0.03 265);
  --destructive: oklch(0.65 0.16 25);
  --destructive-foreground: oklch(0.15 0.01 25);

  /* Surfaces — Soft Dusk: lifted, warm indigo tint */
  --background: oklch(0.20 0.02 265);
  --card: oklch(0.24 0.02 265);
  --popover: oklch(0.24 0.02 265);
  --muted: oklch(0.28 0.02 265);

  /* Text — dimmed for comfort */
  --foreground: oklch(0.87 0.01 260);
  --card-foreground: oklch(0.87 0.01 260);
  --muted-foreground: oklch(0.62 0.015 260);

  /* Borders */
  --border: oklch(0.34 0.02 265);
  --input: oklch(0.34 0.02 265);
  --ring: oklch(0.70 0.12 265);

  /* Sex indicators (brighter, lower chroma for dark bg) */
  --sex-male: oklch(0.70 0.10 240);
  --sex-female: oklch(0.72 0.10 340);
  --sex-unknown: oklch(0.60 0.03 250);

  /* Validation statuses (brighter on dark) */
  --status-confirmed: oklch(0.65 0.12 150);
  --status-proposed: oklch(0.70 0.12 250);
  --status-disputed: oklch(0.72 0.12 80);
}
```

Design direction: "Soft Dusk" — backgrounds lifted to L=0.20 (never near-black), foreground dimmed to L=0.87, warm indigo tint (hue 265°, chroma 0.02) on all surfaces. Target contrast ~6:1 (WCAG AA). See `docs/superpowers/specs/2026-03-29-dark-theme-soft-dusk-design.md` for full rationale.

Theme toggle: `.dark` class applied via next-themes (`attribute="class"`, `defaultTheme="system"`). Three modes: light, dark, system.

---

## Typography

### Font Stack
- **UI:** `font-sans` — Inter (if loaded) or system-ui fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Tree export/print:** Consider serif for printed pedigree charts (Georgia, 'Times New Roman')
- **Monospace (dates, IDs):** `font-mono` — `'Cascadia Code', 'Fira Code', 'Courier New', monospace`

### Scale (Tailwind Defaults)

| Token | Size | Line Height | Use |
|-------|------|-------------|-----|
| `text-xs` | 12px (0.75rem) | 1rem | Metadata, timestamps, badge text |
| `text-sm` | 14px (0.875rem) | 1.25rem | Form labels, table cells, secondary text |
| `text-base` | 16px (1rem) | 1.5rem | Body text, form inputs, descriptions |
| `text-lg` | 18px (1.125rem) | 1.75rem | Section headers, person name in detail panel |
| `text-xl` | 20px (1.25rem) | 1.75rem | Page titles, person name on tree node |
| `text-2xl` | 24px (1.5rem) | 2rem | Dashboard stat numbers, hero text |
| `text-3xl` | 30px (1.875rem) | 2.25rem | Landing/marketing headings only |

### Font Weights
- `font-normal` (400) — body text, descriptions
- `font-medium` (500) — form labels, table headers, badges
- `font-semibold` (600) — section headers, person names, buttons
- `font-bold` (700) — page titles, dashboard stats

---

## Spacing & Layout

### Base Unit
4px (Tailwind default). All spacing is multiples of 4px.

### Layout Dimensions

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Max content width | 1280px | fluid | fluid |
| Left sidebar | 240px (expanded) / 64px (collapsed) | 64px (icons) | hidden (bottom tabs) |
| Person detail panel | 400px (right Sheet) | 400px | full-width bottom sheet |
| Top bar height | 56px | 56px | 56px |
| Bottom tab bar | — | — | 64px |
| Tree toolbar | 48px | 48px | 48px |

### Spacing Tokens

| Use | Token | Value |
|-----|-------|-------|
| Card padding | `p-4` to `p-6` | 16-24px |
| Section spacing | `space-y-6` | 24px |
| Form field gap | `space-y-4` | 16px |
| Inline spacing | `gap-2` to `gap-3` | 8-12px |
| Page padding | `px-6 py-8` | 24px / 32px |
| Mobile page padding | `px-4 py-4` | 16px |

### Breakpoints (Tailwind v4)

| Prefix | Width | Target |
|--------|-------|--------|
| `sm` | 640px | Large phones landscape |
| `md` | 768px | Tablets portrait |
| `lg` | 1024px | Small laptops, tablets landscape |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

### Grid
- 12-column CSS grid for page layouts
- Sidebar + main content + optional detail panel
- Cards: 1-column mobile, 2-column tablet, 3-4 column desktop

---

## Border Radius

| Use | Token | Value |
|-----|-------|-------|
| Buttons, inputs | `rounded-md` | 6px |
| Cards | `rounded-lg` | 8px |
| Modals, sheets | `rounded-xl` | 12px |
| Avatars | `rounded-full` | 50% |
| Tree person nodes | `rounded-lg` | 8px |
| Badges | `rounded-full` | 9999px |

---

## Shadows

| Use | Token |
|-----|-------|
| Cards (elevated) | `shadow-sm` |
| Dropdowns, popovers | `shadow-md` |
| Modals, sheets | `shadow-lg` |
| Tree nodes (hover) | `shadow-md` |
| Tree nodes (selected) | `ring-2 ring-primary` |

---

## Accessibility

- **Contrast:** All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- **Focus indicators:** `ring-2 ring-ring ring-offset-2` on all interactive elements
- **Color not sole indicator:** Sex/status colors always paired with text labels or icons
- **Keyboard navigation:** All interactive elements reachable via Tab, tree navigable via arrow keys
- **Screen reader:** ARIA labels on tree nodes, landmark regions, form fields
- **Motion:** Respect `prefers-reduced-motion` for tree animations
