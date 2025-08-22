# Design System Architecture

## Overview

WeWrite uses a **universal card system** with OKLCH color integration that provides consistent styling across all components. This system is built on semantic color tokens and provides automatic light/dark theme support with future-proof overlay design.

## Architecture Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Design System                            │
│              (Universal Card & Color System)               │
├─────────────────────────────────────────────────────────────┤
│                  OKLCH Color System                        │
│           (Professional 3-Color Architecture)             │
├─────────────────────────────────────────────────────────────┤
│                   Universal Cards                          │
│        (Single Source of Truth for All Cards)             │
├─────────────────────────────────────────────────────────────┤
│                  Theme-Aware Borders                       │
│         (Clean CSS Architecture & Specificity)            │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. **Single Source of Truth**
- All card styling centralized in `wewrite-card` class
- No duplicated CSS across components
- Consistent behavior across all card interfaces
- Universal glassmorphism effects with backdrop blur

### 2. **OKLCH Color Integration**
- Professional 3-color system (accent, neutral, background)
- True component independence (lightness never affects hue)
- Dynamic visual feedback with real-time gradient updates
- Smart limiting system prevents unusable color combinations

### 3. **Clean CSS Architecture**
- No `!important` modifiers anywhere in the codebase
- Proper CSS specificity using data attributes
- Theme-aware borders with automatic light/dark mode support
- Maintainable and reusable component structure

### 4. **Future-Proof Overlay Design**
- Cards as semi-transparent white overlays (70% opacity)
- Works beautifully with custom background colors or images
- Enhanced glassmorphism with backdrop blur and brightness adjustment
- Consistent elevation with adaptive shadows

### 5. **Accessibility First**
- High contrast mode support included
- WCAG AA compliance with automatic contrast checking
- Enhanced focus indicators for glassmorphism elements
- Semantic color tokens with meaningful names

## Universal Card System

### **Core Card Class: `wewrite-card`**

The `wewrite-card` class is the **single source of truth** for all card styling:

```tsx
// Standard card usage
<div className="wewrite-card">
  Card content
</div>

// Floating card with glassmorphism
<div className="wewrite-card wewrite-floating">
  Floating content with backdrop blur
</div>

// Remove rounded corners (for sidebars, etc.)
<div className="wewrite-card !rounded-none">
  Rectangular card
</div>
```

### **Card System Features**
- **Semi-transparent white overlay** (70% opacity) that adapts to any background
- **Glassmorphism effects** with backdrop blur for modern aesthetics
- **Future-proof design** for custom background colors/images
- **Consistent borders** and enhanced shadows for elevation
- **Hover states** with increased opacity (85%) and enhanced shadows
- **Automatic dark mode** support with appropriate transparency

### **Enhanced Glassmorphism**
- **Backdrop blur**: `blur(20px)` for better text readability
- **Saturation boost**: `saturate(180%)` for vibrant appearance
- **Brightness adjustment**: `brightness(1.1)` for better contrast
- **Hover enhancement**: Increased blur and brightness on hover

## OKLCH Color System Integration

### **Professional 3-Color Architecture**

#### 🎨 **ACCENT COLORS**
- **Purpose**: Interactive elements with full expressiveness (L: 0.2-0.8, C: 0.1-1.0)
- **Usage**: PillLinks, CURRENT allocation bars, active states
- **Integration**: Applied consistently throughout UI via CSS custom properties

#### 🔘 **NEUTRAL COLORS**
- **Purpose**: Text and borders with controlled saturation (C: 0.0-0.15)
- **Usage**: Text, borders, icons, subtle UI elements
- **Integration**: Theme-aware borders and text colors

#### 🌫️ **BACKGROUND COLORS**
- **Purpose**: Surfaces with minimal saturation (C: 0.0-0.05)
- **Usage**: Page backgrounds, card surfaces, containers
- **Integration**: Adaptive overlay system works with any background

### **CSS Integration**
```css
/* OKLCH color variables */
--primary: 55.93% 0.6617 284.9;    /* Accent color in OKLCH */
--neutral: 50% 0.05 240;           /* Neutral color in OKLCH */
--background: 98.22% 0.01 240;     /* Background color in OKLCH */

/* Usage with oklch() function */
.element {
  background-color: oklch(var(--primary));
  border-color: oklch(var(--neutral));
}
```

## Border System Architecture

### **Theme-Aware Border Classes**
```css
.border-theme-light    /* Light border (20% opacity) */
.border-theme-medium   /* Medium border (40% opacity) */
.border-theme-strong   /* Strong border (60% opacity) */
.border-theme-solid    /* Solid border (100% opacity) */
```

### **Directional Borders**
```css
.border-t-only         /* Top border only */
.border-b-only         /* Bottom border only */
.border-r-only         /* Right border only */
.border-l-only         /* Left border only */
```

### **Clean CSS Architecture**
```css
/* Clean specificity using data attributes */
.wewrite-active-state {
  border-color: oklch(var(--primary));
  background-color: oklch(var(--primary) / 0.1);
}

/* Theme and pill style selectors */
button[data-theme][data-active="true"],
button[data-pill-style][data-active="true"] {
  border-color: oklch(var(--primary));
  background-color: oklch(var(--primary) / 0.1);
}
```

## Interactive States System

### **Unified Hover & Active States**
All interactive elements use the accent color system for consistent theming:

```css
/* Standard interactive card */
.wewrite-interactive-card          /* hover:bg-primary/5 hover:scale-[1.02] */
.wewrite-interactive-card.active   /* bg-primary/10 ring-2 ring-primary/20 shadow-sm */

/* Hover states */
.wewrite-interactive-hover          /* hover:bg-primary/5 */
.wewrite-interactive-hover-strong   /* hover:bg-primary/10 + scale */

/* Active states */
.wewrite-active-state              /* bg-primary/10 ring-2 ring-primary/20 shadow-sm */
.wewrite-active-state-strong       /* bg-primary/15 + stronger ring */
```

### **Component Examples**
```tsx
// Standard interactive cards (theme selector, pill selector, etc.)
<button className={cn(
  "wewrite-interactive-card p-4 border rounded-lg",
  isActive && "active"
)}>

// Settings menu items (no scale effect)
<button className={cn(
  "hover:bg-primary/5 transition-colors duration-200",
  isActive && "bg-primary/10 ring-2 ring-primary/20"
)}>
```

## Floating Elements & Glassmorphism

### **FloatingCard Component System**
```tsx
import { FloatingCard, FloatingToolbar } from '../ui/FloatingCard';

// Basic floating card
<FloatingCard variant="default">Content</FloatingCard>

// Mobile bottom navigation
<FloatingToolbar isExpanded={false}>Navigation</FloatingToolbar>
```

### **Floating Card Variants**
- **`default`**: Standard glassmorphism for general floating elements
- **`header`**: For floating headers with enhanced transparency
- **`toolbar`**: For mobile bottom navigation with expanded states
- **`overlay`**: For modals and overlays with stronger shadows

### **Shadow System**
1. **Standard floating**: `0_8px_32px_rgba(0,0,0,0.1)` (light) / `0_8px_32px_rgba(0,0,0,0.3)` (dark)
2. **Overlay elements**: `0_12px_40px_rgba(0,0,0,0.15)` (light) / `0_12px_40px_rgba(0,0,0,0.4)` (dark)
3. **Allocation bars**: `0_6px_24px_rgba(0,0,0,0.08)` (light) / `0_6px_24px_rgba(0,0,0,0.25)` (dark)

## Component Guidelines

### **Mobile Navigation**
Mobile toolbar buttons are **square (1:1 aspect ratio)** for consistent touch targets:

```tsx
// Mobile navigation buttons
<Button className="h-11 w-11 rounded-lg">
  <Icon className="h-7 w-7" />
</Button>
```

### **Desktop Sidebar**
The desktop sidebar uses the full card system with glassmorphism:

```tsx
<div className="wewrite-card !rounded-none border-r-only">
  Sidebar content with backdrop blur
</div>
```

## Implementation Guidelines

### **CSS Rules to Follow**
- ✅ Always use `wewrite-card` for card components
- ✅ Use `border-theme-*` for theme-aware borders
- ✅ Use `border-*-only` for directional borders
- ✅ Use OKLCH color space for all color definitions
- ✅ Use proper CSS specificity instead of `!important`
- ✅ Test in both light and dark modes

### **CSS Rules to Avoid**
- ❌ Never use `!important` modifiers anywhere (use proper specificity)
- ❌ Never use `border-border` (use `border-theme-medium`)
- ❌ Never create custom card CSS classes
- ❌ Never use hardcoded border colors
- ❌ Never use RGB/HSL for new color definitions (use OKLCH)
- ❌ Never create aggressive CSS targeting (use data attributes)

## Allocation System Integration

### **Four-Section Allocation Bars**
WeWrite uses a four-section allocation bar system with consistent visual design:

#### **Sections**
1. **OTHER** (grey, leftmost) - Funds allocated to other pages
2. **CURRENT** (accent color) - Funds allocated to current page within budget
3. **OVERSPENT** (orange) - Funds allocated beyond available budget
4. **AVAILABLE** (empty, rightmost) - Remaining unallocated funds

#### **Visual States**
- **Normal state**: Shows available funds as positive numbers
- **Overspent state**: Shows "Out" instead of negative values
- **Orange indicators**: Used consistently for overspent funds (not red)

#### **Design Consistency**
- All allocation bars use the universal card system
- Floating allocation bars lose card styling when scrolled to top
- Mobile allocation bars maintain proper touch targets (40px minimum)

## Migration Guide

### **From Legacy Classes**
| ❌ **Old (Deprecated)** | ✅ **New (Universal)** |
|-------------------------|------------------------|
| `border-border` | `border-theme-medium` |
| `liquid-glass` | `wewrite-card wewrite-floating` |
| `glass-overlay` | `wewrite-card` |
| `bg-white dark:bg-card` | `wewrite-card` |
| `hover:bg-muted/50` | `hover:bg-primary/5` |
| `bg-muted ring-primary/20` | `bg-primary/10 ring-2 ring-primary/20` |

### **Migration Checklist**
- [ ] Replace `border-border` with `border-theme-medium`
- [ ] Replace custom card CSS with `wewrite-card`
- [ ] Use `border-*-only` for directional borders
- [ ] Update hover states to use accent color system
- [ ] Test all changes in both light and dark modes
- [ ] Ensure mobile touch targets are 44px minimum

## Enhanced Customization Features

### ✅ **OKLCH CUSTOMIZATION FEATURES**
- **Professional 3-Color System**: Accent, neutral, background with smart limits
- **True Component Independence**: Lightness never affects hue (fixed precision loss)
- **Dynamic Visual Feedback**: Gradients show actual color relationships
- **Smart Limiting System**: Prevents unusable color combinations
- **Pure OKLCH Workflow**: Minimal conversions, no precision loss
- **Clean CSS Architecture**: No `!important`, proper specificity
- **Theme-Aware Integration**: Accent colors apply consistently throughout UI
- **Real-time Preview**: All customizations update instantly with proper feedback
- **Persistent Settings**: All preferences saved with OKLCH precision

## Design System Compliance

- ✅ **Global Background**: Customizable (solid colors or gradients)
- ✅ **Card Overlay**: Enhanced semi-transparent white (`rgba(255, 255, 255, 0.75)`)
- ✅ **Enhanced Glassmorphism**: Backdrop blur with brightness and saturation adjustments
- ✅ **Future-Proof**: Cards work perfectly with any background color/image
- ✅ **Theme Consistency**: Automatic light/dark mode support
- ✅ **Enhanced Shadows**: Dynamic shadows that adapt to background complexity

## Quick Reference

### **Essential Classes**
```css
/* Cards */
.wewrite-card              /* Universal card styling */
.wewrite-floating          /* Adds glassmorphism effects */

/* Borders */
.border-theme-light        /* 20% opacity border */
.border-theme-medium       /* 40% opacity border */
.border-theme-strong       /* 60% opacity border */
.border-t-only            /* Top border only */
.border-b-only            /* Bottom border only */
.border-r-only            /* Right border only */
.border-l-only            /* Left border only */

/* Interactive States */
.wewrite-interactive-card  /* Standard interactive card */
.wewrite-active-state      /* Active state styling */
```

## Related Documentation

- **[OKLCH Color System](./OKLCH_COLOR_SYSTEM.md)** - Complete OKLCH color system details
- **[Theme System Architecture](./THEME_SYSTEM_ARCHITECTURE.md)** - Theme system implementation
- **[Border Styling Guidelines](./BORDER_STYLING_GUIDELINES.md)** - Comprehensive border system
