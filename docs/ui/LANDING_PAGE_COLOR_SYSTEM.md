# Landing Page Color System - Complete Rebuild

## Problem Statement

The landing page has scroll-animated accent colors that should:
1. Start at blue (230° hue) and cycle through the color spectrum as the user scrolls
2. Apply to gradient blobs, cards, borders, and UI elements
3. Work consistently across all viewport sizes (especially mobile ~700px)

**Current Issue**: Colors "flash blue then revert to black/high-contrast" on mobile. This is caused by race conditions between:
- `AccentColorContext` - sets user's saved accent color
- `NeutralColorContext` - sets card/border colors based on user preferences
- `LandingPage` - tries to override with scroll-animated colors

The contexts run at unpredictable times and overwrite the landing page's colors.

## Solution: Complete Isolation

**Key Insight**: The landing page should NOT use the global CSS variable system (`--accent-h`, `--card-bg`, etc.) that the rest of the app uses. Instead, it should have its own isolated color system that cannot be overwritten.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Landing Page                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         LandingColorProvider (Context)           │   │
│  │  - Manages scroll-based hue (230° → 360° → 0°)  │   │
│  │  - Provides computed colors to children          │   │
│  │  - NO global CSS variables                       │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│    ┌─────────────────────┼─────────────────────┐       │
│    ▼                     ▼                     ▼       │
│  Blobs               Cards                 Buttons     │
│  (inline style)    (inline style)        (inline style)│
└─────────────────────────────────────────────────────────┘
```

### Requirements

#### 1. Color Values (OKLCH Format)
- **Hue**: Starts at 230° (blue), cycles through spectrum on scroll
- **Lightness**: 0.50 (50%) for accent colors
- **Chroma**: 0.25 for vibrant but readable colors

#### 2. Derived Colors

```typescript
// Given: hue (0-360), lightness (0.50), chroma (0.25)

// Accent color (for blobs, buttons, links)
accent = oklch(0.50, 0.25, hue)

// Card background (light mode)
cardBg = oklch(1.00, chroma * 0.2, hue) / 0.15  // 15% opacity white with slight tint

// Card background (dark mode)
cardBg = oklch(0.98, chroma * 0.4, hue) / 0.06  // 6% opacity with more tint

// Card border (light mode)
cardBorder = oklch(0.30, chroma * 0.6, hue) / 0.15

// Card border (dark mode)
cardBorder = oklch(0.80, chroma * 0.5, hue) / 0.15

// Hover states: +5% opacity for backgrounds, +5% opacity for borders
```

#### 3. Components Using Colors

1. **Gradient Blobs** (`.landing-blob`)
   - Background: `oklch(L C H / 0.7)` where L=0.50, C=0.25, H=scroll hue

2. **Cards** (`.wewrite-card` on landing page only)
   - Background: Computed based on theme + hue
   - Border: Computed based on theme + hue
   - Must NOT use `var(--card-bg)` etc.

3. **Primary Buttons**
   - Background: accent color
   - Text: white or black based on luminance

4. **Links/Accents**
   - Color: accent color

#### 4. Scroll Animation

```typescript
// Calculate hue based on scroll position
const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
const scrollProgress = Math.min(window.scrollY / maxScroll, 1);
const hue = (230 + scrollProgress * 360) % 360; // Full spectrum cycle
```

### Implementation Plan

#### Step 1: Create `LandingColorContext`

A new React context specifically for landing page colors:

```typescript
// app/components/landing/LandingColorContext.tsx
interface LandingColors {
  hue: number;
  accent: string;           // oklch string
  cardBg: string;           // oklch string with opacity
  cardBgHover: string;
  cardBorder: string;
  cardBorderHover: string;
  blobColor: string;
}

const LandingColorContext = createContext<LandingColors>(defaultColors);
```

#### Step 2: Create `LandingColorProvider`

Wraps the landing page and provides scroll-animated colors:

```typescript
// Handles scroll listener
// Computes all derived colors
// Detects light/dark mode
// Provides colors via context (NOT CSS variables)
```

#### Step 3: Create Landing-Specific Card Component

```typescript
// app/components/landing/LandingCard.tsx
// Uses inline styles from LandingColorContext
// Does NOT use .wewrite-card class
// Does NOT rely on any global CSS variables
```

#### Step 4: Update Blob CSS

Change from CSS variables to a CSS class that can be styled via inline styles:

```css
.landing-blob {
  /* Static properties only */
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
  /* background set via inline style */
}
```

#### Step 5: Update LandingPage Component

- Wrap in `LandingColorProvider`
- Replace `.wewrite-card` with `LandingCard`
- Pass colors to blobs via inline styles
- Remove all `document.documentElement.style.setProperty` calls

### File Changes

1. **NEW**: `app/components/landing/LandingColorContext.tsx`
2. **NEW**: `app/components/landing/LandingCard.tsx`
3. **MODIFY**: `app/components/landing/LandingPage.tsx`
4. **MODIFY**: `app/globals.css` (blob styles - remove CSS var dependency)
5. **CLEANUP**: Remove landing page special cases from:
   - `AccentColorContext.tsx`
   - `NeutralColorContext.tsx`
   - `card-theme.css`

### Benefits of This Approach

1. **Complete Isolation**: Landing page colors cannot be overwritten by any other code
2. **No Race Conditions**: Colors are managed by a single source of truth
3. **Simpler Code**: No need for `data-landing-page` attributes, RAF delays, etc.
4. **Testable**: Easy to verify colors are correct at any scroll position
5. **Maintainable**: Clear separation between landing page and app color systems

### Testing Checklist

- [ ] Colors start blue (230° hue) on page load
- [ ] Colors animate smoothly as user scrolls
- [ ] Colors work at desktop breakpoint (>1024px)
- [ ] Colors work at tablet breakpoint (~768px)
- [ ] Colors work at mobile breakpoint (~700px and below)
- [ ] Dark mode shows correct colors
- [ ] Light mode shows correct colors
- [ ] Blobs have correct gradient color
- [ ] Cards have correct background and border
- [ ] No "flash" of wrong colors on load
- [ ] No console errors related to colors
