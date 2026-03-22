# Style Philosophy — Ancstra

Design principles and visual direction for the Ancstra genealogy app. This document governs all design decisions across Figma artifacts, component implementations, and UI patterns.

---

## Emotional Register: Heritage Modern

Ancstra feels like **a beautifully restored family home with modern fixtures**. It conveys warmth and trust — your family history is safe here — while maintaining the cleanliness and precision of a contemporary productivity tool.

- **Warmth** comes from typography (Inter's friendly geometry), generous line-heights, subtle amber accents on key actions, and soft shadows
- **Cleanliness** comes from generous whitespace, restrained color usage, consistent spacing, and strong type hierarchy
- **Trust** comes from structured data presentation, clear status indicators, and visible source citations

The interface never feels cold or clinical, but it also never feels decorative or playful. It respects the seriousness of genealogy research while remaining approachable to newcomers.

---

## Color Palette: Indigo Heritage

**Primary:** `oklch(0.50 0.14 265)` — Warm indigo-blue. Used for navigation, interactive elements, links, and primary buttons. Shifts toward warmth (indigo) rather than pure blue to match the Heritage Modern tone.

**Secondary:** `oklch(0.62 0.07 160)` — Muted sage green. Used for confirmed statuses, success states, completion indicators, and the living-person badge. Deliberately desaturated — green should reassure, not shout.

**Accent:** `oklch(0.72 0.13 60)` — Burnished gold. Used sparingly for the most important CTA on each screen, amber section labels in Heritage Modern treatment, and attention-drawing elements. This is the warmth in the palette.

### Color Usage: Rare and Meaningful

90% of the interface is neutral (white, grays, slate). Color appears ONLY when it carries meaning:

| Color appears for | Never for |
|---|---|
| Sex indicators on tree nodes (blue/pink/gray borders) | Decorative backgrounds |
| Validation status (confirmed/proposed/disputed) | Section dividers |
| Completion levels (low/medium/high) | Random variety |
| Interactive elements (buttons, links, focus rings) | Ambient tinting |
| The single most important CTA per screen (accent gold) | Multiple competing CTAs |

**Rule:** If you remove all color from a screen and it becomes harder to use, the color is meaningful. If the screen works just as well in grayscale, the color was decorative — remove it.

---

## Information Density: Adaptive

Two explicit density modes serve different personas:

**Quick View** (default for new users, Alex/Jordan persona):
- Spacious layout with only essential info visible
- Tree nodes show: name + dates + completion bar
- Detail panel shows: summary header, expandable sections
- Forms show: required fields, optional fields collapsed

**Research View** (toggled in settings, Margaret persona):
- Dense but structured — all data visible, organized by strong visual hierarchy
- Tree nodes show: name + dates + completion + source count + validation status
- Detail panel shows: all sections expanded, inline editing
- Forms show: all fields visible, batch entry shortcuts

The toggle is per-user, persisted in settings. Individual screens may also offer expand/collapse for specific sections regardless of mode.

---

## Empty States: Confident Guide

When the app has no data, it is direct and actionable:

> **Start building your tree.**
> 1. Add yourself
> 2. Add your parents
> 3. Keep going

No illustrations, no sentimentality, no "every family has a story" copy. The empty state gets users into the app as fast as possible. Clean layout, numbered steps, two clear CTAs: "Add your first person" (primary) and "Import a GEDCOM file" (secondary, text link).

After the first person is added, the interface immediately shows a tree node and prompts the next action. The app rewards progress, not browsing.

---

## Typography

**Font:** Inter (Google Fonts) with system-ui fallback. Chosen for its friendly geometry, excellent readability at small sizes, and extensive weight range.

**Mono:** Fira Code (Google Fonts) with ui-monospace fallback. Used for OKLCH values, dates in technical contexts, IDs, and code-like metadata.

**Hierarchy through weight, not size:** Prefer varying font-weight (400 vs 600 vs 700) over varying font-size to create hierarchy. Size changes are reserved for true level changes (page title vs section header vs body). Within a component, weight does the work.

---

## Spacing

**Base unit:** 4px (Tailwind default). All spacing is multiples of 4.

**Principle:** Generous but not wasteful. Whitespace should help the user's eye parse groups and relationships, not make them scroll needlessly. In Research View, spacing tightens by ~25% to increase data density.

---

## Shadows & Elevation

Shadows are warm-toned and subtle. They indicate interactivity (hover, cards) rather than depth hierarchy.

- `shadow-sm` — cards, resting state
- `shadow-md` — hover states, dropdowns
- `shadow-lg` — modals, sheets
- `ring-2 ring-primary` — selected/focused state (indigo ring)

No shadows purely for decoration. If an element doesn't need to appear elevated, it doesn't get a shadow.

---

## Border Radius

Slightly soft, never bubbly:
- `6px` — buttons, inputs (functional elements)
- `8px` — cards, tree nodes (content containers)
- `12px` — modals, sheets (overlay surfaces)
- `50%` — avatars, badges (circular elements)

---

## Iconography

Lucide icon set, 20px default size. Icons are functional, not decorative:
- Every icon must have a text label (except in the collapsed sidebar where tooltips provide labels)
- Icon color matches the text it accompanies — never a different color for visual interest
- Event type icons (birth, death, marriage) are the one exception: they use subtle contextual color to aid scanning in timelines

---

## Progressive Disclosure

The interface reveals complexity gradually:
1. **First visit:** Minimal UI, guided steps, required fields only
2. **Building a tree:** More options appear contextually ("Add relative" buttons appear on person detail after first person exists)
3. **Power usage:** Research View unlocks full density, keyboard shortcuts, batch operations
4. **Never hidden:** Nothing is gated behind a paywall or artificial progression — advanced features are always available in settings, just not in-your-face for beginners

---

## Principles Summary

1. **Color is signal, not decoration** — every spot of color earns its place
2. **Warmth through typography and spacing** — not through color tinting
3. **Respect the data** — genealogy is serious; the interface treats it with care
4. **Two speeds** — Quick View for building, Research View for investigating
5. **Progressive, not hidden** — complexity is available, not imposed
6. **Heritage Modern** — a restored family home with modern fixtures
