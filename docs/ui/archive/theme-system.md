# WeWrite Theme System Documentation

## Overview

WeWrite uses a centralized theme system based on Radix Colors design principles to ensure consistent styling across all card components. This system provides semantic color tokens, automatic dark mode support, and a single source of truth for all card styling.

## Design Principles

- **Single Source of Truth**: All card styling is centralized in one place
- **Semantic Color Tokens**: Use meaningful names instead of hardcoded values
- **Industry Standards**: Based on Radix Colors design system
- **Theme Awareness**: Automatic light/dark mode support
- **Accessibility**: High contrast mode support included

## Card Theme System

### Core Files

1. **`app/styles/card-theme-system.ts`** - TypeScript definitions and semantic tokens
2. **`app/styles/card-theme.css`** - CSS implementation with custom properties
3. **`app/globals.css`** - Global import of the card theme system

### CSS Custom Properties

The system uses CSS custom properties that automatically adapt to light/dark themes:

```css
:root {
  /* Light theme */
  --card-bg: hsl(210, 40%, 98%);
  --card-bg-hover: hsl(210, 40%, 96%);
  --card-floating-bg: rgba(255, 255, 255, 0.85);
  --card-floating-bg-hover: rgba(255, 255, 255, 0.95);
  --card-border: hsl(210, 20%, 82%);
  --card-border-hover: hsl(210, 20%, 78%);
  --card-text: hsl(210, 24%, 16%);
  --card-text-muted: hsl(210, 16%, 46%);
}

.dark {
  /* Dark theme - completely neutral grey (zero saturation) */
  --card-bg: hsl(0, 0%, 17%);
  --card-bg-hover: hsl(0, 0%, 20%);
  --card-floating-bg: rgba(20, 20, 20, 0.85);
  --card-floating-bg-hover: rgba(20, 20, 20, 0.95);
  --card-border: hsl(0, 0%, 34%);
  --card-border-hover: hsl(0, 0%, 40%);
  --card-text: hsl(0, 0%, 98%);
  --card-text-muted: hsl(0, 0%, 65%);
}
```

## Universal Card System

### One Card Class for Everything

Use `.wewrite-card` for ALL card components:

```tsx
<!-- Standard cards -->
<div className="wewrite-card">
  Standard card content
</div>

<!-- Floating cards (glassmorphism) -->
<div className="wewrite-card wewrite-floating">
  Floating card content
</div>

<!-- Daily notes cards -->
<div className="wewrite-card wewrite-daily-notes">
  Daily notes content
</div>
```

**Universal Features:**
- **Glassmorphism by default**: All `wewrite-card` components include subtle transparency and backdrop blur
- Consistent background and borders across light/dark themes
- Theme-aware borders that adapt automatically
- Responsive hover states
- Accessibility support with high contrast mode
- Single source of truth for all styling changes

### Text Utilities

Use semantic text classes:

```tsx
<p className="wewrite-card-text">Primary text</p>
<p className="wewrite-card-text-muted">Muted text</p>
```

## Migration Guide

### Migration to Universal System

| Old Classes | New Universal Classes |
|-------------|-------------|
| `bg-white dark:bg-card` | `wewrite-card` |
| `bg-white/15 dark:bg-black/15` | `wewrite-card wewrite-floating` |
| `glass-overlay` (deprecated) | `wewrite-card` |
| `wewrite-card-v2` | `wewrite-card` |
| `wewrite-floating-card-v2` | `wewrite-card wewrite-floating` |
| `wewrite-daily-card-v2` | `wewrite-card wewrite-daily-notes` |
| `border-theme-strong` | (handled by card classes) |
| `text-card-foreground` | `wewrite-card-text` |
| `text-muted-foreground` | `wewrite-card-text-muted` |

### Component Updates

All components now use the universal card system:

- **FloatingCard.tsx** - Uses `wewrite-card wewrite-floating`
- **Card.tsx** - Uses `wewrite-card`
- **DayContainer.tsx** - Uses `wewrite-card wewrite-daily-notes`
- **DropdownMenu.tsx** - Uses `wewrite-card wewrite-floating`
- **ActivityCard.tsx** - Uses `wewrite-card`

## Color Scale Reference

Based on Radix Colors semantic scale:

- **1-2**: App backgrounds
- **3-5**: Component backgrounds (our cards)
- **6-8**: Borders and separators
- **9-10**: Solid colors
- **11-12**: Text colors

## Responsive Design

The system includes responsive adjustments:

```css
@media (max-width: 768px) {
  .wewrite-card {
    padding: 0.75rem;
  }
}

@media (min-width: 1024px) {
  .wewrite-card:hover {
    transform: translateY(-1px);
  }
}
```

## Accessibility

### High Contrast Mode

The system automatically supports high contrast mode:

```css
html[data-high-contrast="true"] .wewrite-card {
  border-width: 2px;
  border-color: var(--card-text);
}
```

## Recent Improvements (2025)

### Appearance Settings Enhancements

- **Improved Slider Dots**: Slider thumbs now extend outside container edges to prevent clipping
- **Better Visibility**: White slider dots with shadows for visibility in both light and dark modes
- **Background Blur**: New background blur slider (0-20px range) for background images
- **Theme-Aware Loading**: Dark mode loading backgrounds are now black instead of grey

### UI Consistency Improvements

- **Unified Profile Cards**: User profile top section now uses consistent card styling
- **Card-Style Search**: Pages search input now uses card styling for consistency
- **Switch Component**: Dense mode toggle off state now uses `neutral-20` background
- **Neutral Color Inheritance**: All neutral colors now properly inherit chroma settings

## Making Changes

### Single Source Updates

To modify card styling across the entire application:

1. **Update CSS Variables** in `app/styles/card-theme.css`
2. **Modify TypeScript Tokens** in `app/styles/card-theme-system.ts` (if needed)
3. Changes automatically apply to all components using the system

### Example: Changing Card Background

```css
/* In app/styles/card-theme.css */
:root {
  --card-bg: hsl(210, 40%, 99%); /* Lighter background */
}

.dark {
  --card-bg: hsl(215, 28%, 15%); /* Darker background */
}
```

This change will immediately affect all cards using `wewrite-card`.

## Best Practices

1. **Always use semantic classes** instead of hardcoded colors
2. **Test in both light and dark modes** when making changes
3. **Verify high contrast mode** for accessibility
4. **Use the migration helpers** for gradual component updates
5. **Maintain consistent opacity levels** for glassmorphism effects

## Browser Support

- **Backdrop Filter**: Modern browsers (Chrome 76+, Firefox 103+, Safari 9+)
- **CSS Custom Properties**: All modern browsers
- **Fallbacks**: Graceful degradation for older browsers
