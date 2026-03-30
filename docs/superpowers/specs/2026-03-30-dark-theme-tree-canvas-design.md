# Dark Theme: Minimap & Tree Canvas Adaptation

**Date:** 2026-03-30
**Status:** Approved

## Problem

The tree canvas MiniMap, Background, Controls, edges, and "no dates" text use hardcoded light-theme colors that clash with the Soft Dusk dark palette. The tree export also uses hardcoded white backgrounds.

## Design Decisions

- **MiniMap nodes**: Uniform `--muted-foreground` color (no sex-color coding)
- **Edges**: All neutral `--muted-foreground` regardless of validation status — status conveyed by dash pattern only
- **No new CSS variables** — everything maps to existing Soft Dusk tokens
- **Background dots**: `--border` token — subtle in both light (L=0.90) and dark (L=0.34)

## Changes

### 1. MiniMap (tree-canvas.tsx)

Add `nodeColor` and `maskColor` props:
- `nodeColor` → CSS variable `--muted-foreground`
- `maskColor` → semi-transparent dark overlay `rgba(0,0,0,0.15)` in light, `rgba(0,0,0,0.4)` in dark
- Alternative: use a single `maskColor` that works in both via CSS variable

### 2. Background dots (tree-canvas.tsx)

Add `color` prop to `<Background>`:
- `color="var(--border)"` — adapts automatically via Soft Dusk tokens

### 3. Controls (globals.css)

Add CSS overrides for XYFlow control buttons:
- `.react-flow__controls-button` fill/stroke should use `--foreground`
- `.dark .react-flow__controls-button` for dark-specific adjustments

### 4. Edges (parent-child-edge.tsx, partner-edge.tsx)

Replace all hardcoded hex colors with `var(--muted-foreground)`:
- `#6b7280` → `var(--muted-foreground)`
- `#3b82f6` → `var(--muted-foreground)`
- `#f59e0b` → `var(--muted-foreground)`
- `#9ca3af` → `var(--muted-foreground)`
- Dash patterns remain unchanged (they convey status)

### 5. Tree export (tree-export.tsx)

Replace hardcoded `#f8fafc` and `#ffffff` with computed values from `getComputedStyle()` reading `--background` CSS variable at export time.

### 6. "no dates" text (person-node.tsx)

Replace `text-amber-500/80` with `text-muted-foreground italic` — this is absent data, not a warning signal.
