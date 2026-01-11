# CSS System Refactoring Plan

## Current State Analysis

### File Sizes
| File | Lines | Purpose |
|------|-------|---------|
| `globals.css` | 5,328 | Main CSS - bloated with many systems |
| `card-theme.css` | 371 | Card glassmorphism (now mostly unused) |
| `content-display.css` | 329 | Content viewer styles |
| `editor-styles.css` | 252 | Slate editor styles |
| `allocation-bar-animations.css` | 283 | Payment allocation animations |
| `fixed-layer.css` | 101 | Z-index and fixed positioning |
| **Total** | **6,664** | |

### Problems Identified
1. **Duplicated systems**: Multiple "shiny" classes for pills, buttons, badges, allocation bars
2. **Dead code**: Card glassmorphism system (`wewrite-card`, `wewrite-floating`) now deprecated
3. **Radix color classes**: 400+ lines of manually defined `.bg-neutral-alpha-N`, `.text-accent-N` etc. that duplicate what Tailwind already provides
4. **Mobile admin overrides**: 150+ lines of hacky `!important` overrides
5. **Scattered CSS variables**: Defined in 5+ places across different files
6. **Input system complexity**: 150+ lines for `.wewrite-input` with glassmorphism

### What to KEEP (PillLink dependencies)
From `PillStyleContext.tsx`, PillLink uses these CSS classes:
- `pill-shiny-style` (lines 193-245 in globals.css)
- `pill-outline-shiny-style` (lines 251-278)
- `shiny-shimmer-base` (lines 318-400)
- `shiny-glow-base` (extends shimmer base)
- Touch device fixes for `[data-pill-style]` (lines 284-316)
- `@keyframes shimmer` animation

---

## Proposed New Structure

### Phase 1: Consolidate CSS Variables
Create a single source of truth for all CSS variables:

```
app/styles/
├── variables.css        # ALL CSS variables (colors, spacing, z-index)
├── base.css            # Tailwind base layer + html/body defaults
├── components/
│   ├── pill-links.css  # PillLink shiny system (KEEP intact)
│   ├── buttons.css     # Button shiny variants
│   ├── inputs.css      # Simplified input styles
│   └── modals.css      # Dialog/drawer backdrop styles
├── utilities.css       # Touch utilities, scrollbar, selection
└── animations.css      # All @keyframes
```

### Phase 2: Simplify Color System
**Remove from globals.css:**
- All 400+ manual Radix-style color utility classes (`.bg-neutral-alpha-N`, etc.)
- These are already available via Tailwind config

**Keep in Tailwind config:**
- The existing color definitions in `tailwind.config.ts` already handle this

### Phase 3: Remove Dead Code
**Delete entirely:**
- Card glassmorphism system (`.wewrite-card`, `.wewrite-floating`, `card-theme.css`)
- Replace remaining usages with `bg-popover border-border`
- Mobile admin page overrides (use responsive Tailwind instead)

### Phase 4: Simplify Shiny System
**Current:** 6 different shiny classes (pill, button variants, badge, allocation-bar)
**Proposed:** 2 base classes + color modifiers

```css
/* Base shimmer effect */
.shimmer { /* shimmer animation */ }

/* Glow effect - uses CSS custom property for color */
.glow {
  --glow-color: var(--primary);
  box-shadow: 0 0 4px oklch(var(--glow-color) / 0.3), ...;
}

/* Usage */
.shimmer.glow { --glow-color: var(--accent-base); } /* Pills */
.shimmer.glow { --glow-color: var(--primary); }     /* Buttons */
.shimmer.glow { --glow-color: var(--error); }       /* Destructive */
```

---

## Migration Strategy

### Step 1: Extract & Preserve PillLink Styles
1. Create `app/styles/components/pill-links.css`
2. Move pill-shiny, pill-outline-shiny, shimmer base, and touch fixes
3. Test PillLink still works in all 4 styles

### Step 2: Create New Variables File
1. Create `app/styles/variables.css`
2. Consolidate all `:root` definitions from:
   - `globals.css` (lines 1718-1900)
   - `card-theme.css` (lines 13-37)
   - `fixed-layer.css` (lines 3-29)
3. Remove card-bg/card-border variables (no longer needed)

### Step 3: Delete Radix Color Utilities
1. Remove lines 3393-3710 from globals.css (manual color utilities)
2. These are already in Tailwind config - components should use `bg-neutral-10` etc.

### Step 4: Simplify Input System
1. Create `app/styles/components/inputs.css`
2. Remove glassmorphism, use solid backgrounds:
```css
.wewrite-input {
  @apply bg-background border border-border rounded-lg px-4 py-3;
  @apply focus:border-accent focus:ring-2 focus:ring-accent/20;
}
```

### Step 5: Clean Up Button Shiny
1. Create single `.button-shiny` class in `buttons.css`
2. Use CSS custom properties for color variants
3. Remove duplicate button-*-shiny-style classes

### Step 6: Remove Mobile Admin Hacks
1. Delete lines 4360-4500 (mobile-admin-page overrides)
2. Update admin pages to use responsive Tailwind classes directly

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Total CSS lines | 6,664 | ~2,500 |
| CSS files | 6 | 8 (more organized) |
| Shiny class variants | 12+ | 2 base + modifiers |
| Manual color utilities | 400+ | 0 (use Tailwind) |
| Card glassmorphism code | 371 lines | 0 |

## Risk Mitigation
- **PillLink**: Extract FIRST, test BEFORE other changes
- **Incremental**: Each phase is independently deployable
- **Visual regression**: Screenshot key pages before/after

## Files to Modify
1. `app/globals.css` - Major reduction
2. `app/styles/card-theme.css` - DELETE
3. `app/tailwind.config.ts` - No changes needed
4. Various components using `wewrite-card` - Update to `bg-popover`
