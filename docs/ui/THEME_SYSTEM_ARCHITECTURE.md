# WeWrite Theme System Architecture

## Overview

WeWrite implements a comprehensive theme system that provides seamless light/dark mode switching, high contrast accessibility support, and consistent styling across the entire application. The system is built on CSS variables, Tailwind CSS, and React context providers.

## 🎨 **Core Architecture**

### Theme Provider Structure
```typescript
// app/providers/ThemeProvider.tsx
export function ThemeProvider({ children }: ThemeProviderProps) {
  // Wraps next-themes with additional high contrast support
  // Provides: theme, setTheme, highContrast, toggleHighContrast
}

export function useTheme() {
  // Extended hook with high contrast mode support
  // Returns: theme, setTheme, highContrast, toggleHighContrast
}
```

### CSS Variable System
```css
/* app/globals.css */
:root {
  /* Light mode variables */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --border: 215 20% 85%;
  --primary: var(--accent-h) var(--accent-s) var(--accent-l);
  /* ... */
}

.dark {
  /* Dark mode variables */
  --background: 0 0% 0%;
  --foreground: 210 40% 98%;
  --border: 217 33% 25%;
  /* ... */
}

[data-high-contrast="true"] {
  /* High contrast mode overrides */
  --border: 0 0% 100%;
  --destructive: 0 100% 60%;
  /* ... */
}
```

## 🎯 **Theme Tokens**

### Color Categories

#### Background & Foreground
- `--background` / `--foreground` - Primary page colors
- `--card` / `--card-foreground` - Card container colors
- `--popover` / `--popover-foreground` - Overlay colors

#### Interactive Elements
- `--primary` / `--primary-foreground` - Primary action colors
- `--secondary` / `--secondary-foreground` - Secondary action colors
- `--muted` / `--muted-foreground` - Subdued content colors

#### State Colors
- `--destructive` / `--destructive-foreground` - Error states
- `--success` / `--success-foreground` - Success states
- `--border` - Border colors (theme-aware)
- `--ring` - Focus ring colors

### Accent Color System
```css
/* Dynamic accent colors */
--accent-h: 217;        /* Hue */
--accent-s: 91%;        /* Saturation */
--accent-l: 60%;        /* Lightness */
--accent-color-rgb: 23, 104, 255;  /* RGB values */
```

## 🛠 **Border System**

### Theme-Aware Border Classes
```css
/* Opacity-based borders that adapt to theme */
.border-theme-light    /* 20% opacity */
.border-theme-medium   /* 40% opacity */
.border-theme-strong   /* 60% opacity */
.border-theme-solid    /* 100% opacity */
```

### Interactive States
```css
.hover-border-light    /* 30% opacity on hover */
.hover-border-medium   /* 50% opacity on hover */
.hover-border-strong   /* 70% opacity on hover */
.hover-border-solid    /* 100% opacity on hover */
```

### Directional Borders
```css
.border-t-only         /* Top border only */
.border-b-only         /* Bottom border only */
.border-r-only         /* Right border only */
.border-l-only         /* Left border only */
```

## 🎨 **Usage Patterns**

### Component Styling
```jsx
// ✅ CORRECT - Use theme tokens
<div className="bg-background text-foreground border-theme-strong">
  Content
</div>

// ❌ INCORRECT - Hardcoded colors
<div className="bg-white dark:bg-gray-900 text-black dark:text-white border-gray-200 dark:border-gray-700">
  Content
</div>
```

### Interactive Elements
```jsx
// ✅ CORRECT - Theme-aware interactive styling
<button className="bg-primary text-primary-foreground hover:bg-primary/90 border-theme-strong hover-border-strong">
  Button
</button>

// ❌ INCORRECT - Manual dark mode handling
<button className="bg-blue-600 dark:bg-blue-500 text-white border-blue-700 dark:border-blue-400">
  Button
</button>
```

## 🔧 **Implementation Guidelines**

### 1. Always Use Theme Tokens
- Use CSS variables through Tailwind classes
- Never hardcode colors or use manual dark mode classes
- Leverage the opacity system for consistent transparency

### 2. High Contrast Support
- All components automatically support high contrast mode
- Use `data-high-contrast="true"` attribute for testing
- Enhanced borders and focus indicators in high contrast mode

### 3. Accessibility
- Focus states use enhanced ring indicators
- High contrast mode increases opacity for better visibility
- All color combinations maintain proper contrast ratios

### 4. Performance
- CSS variables ensure optimal performance
- No JavaScript calculations for theme switching
- Minimal re-renders when switching themes

## 🚨 **Deprecated Patterns**

### ❌ Never Use These
```css
/* Hardcoded colors */
border-gray-200
border-neutral-300
dark:border-gray-700

/* Manual dark mode handling */
bg-white dark:bg-gray-900
text-black dark:text-white

/* Non-theme-aware borders */
border-current/20
border-opacity-30
```

### ✅ Use These Instead
```css
/* Theme-aware alternatives */
border-theme-medium
bg-background
text-foreground
border-border
```

## 📁 **File Structure**

### Core Files
- `app/providers/ThemeProvider.tsx` - Theme context and hooks
- `app/globals.css` - CSS variables and theme definitions
- `app/components/utils/ThemeToggle.tsx` - Theme switching UI
- `tailwind.config.ts` - Tailwind theme configuration

### Documentation
- `docs/BORDER_STYLING_GUIDELINES.md` - Border system details
- `docs/DEPRECATED_UI_PATTERNS.md` - Patterns to avoid
- `docs/THEME_SYSTEM_ARCHITECTURE.md` - This document

## 🔍 **Debugging & Testing**

### Theme Switching
```javascript
// Test theme switching
const { theme, setTheme } = useTheme();
setTheme('light');   // Switch to light mode
setTheme('dark');    // Switch to dark mode
setTheme('system');  // Use system preference
```

### High Contrast Mode
```javascript
// Test high contrast mode
const { highContrast, toggleHighContrast } = useTheme();
toggleHighContrast(); // Toggle high contrast mode
```

### CSS Variable Inspection
```css
/* Check current theme values in DevTools */
:root {
  --background: /* Current background value */
  --foreground: /* Current foreground value */
  --border: /* Current border value */
}
```

## 📝 **Code Review Checklist**

When reviewing theme-related code:
- [ ] Uses theme tokens instead of hardcoded colors
- [ ] No manual dark mode classes (`dark:*`)
- [ ] Proper use of border system classes
- [ ] High contrast mode compatibility
- [ ] Accessibility considerations met
- [ ] Performance implications considered

## 🛡️ **Common Anti-Patterns Fixed**

### Recently Eliminated Issues
During our theme system audit, we identified and fixed these problematic patterns:

#### ❌ Non-Theme-Compatible Separators
```css
/* FIXED: PayoutCountdownTimer separator */
border-t border-current/20  /* ❌ Bad - doesn't adapt to themes */
border-t border-border      /* ✅ Good - theme-aware */
```

#### ❌ Hardcoded Border Colors
```css
/* FIXED: Multiple components */
border-gray-400             /* ❌ Bad - hardcoded */
border-theme-strong         /* ✅ Good - theme-aware */

border border-gray-200 dark:border-gray-700  /* ❌ Bad - manual dark mode */
border-theme-medium         /* ✅ Good - automatic adaptation */
```

#### ❌ Redundant Dark Mode Classes
```css
/* FIXED: SimilarPages component */
border-border dark:border-border  /* ❌ Bad - redundant */
border-border                     /* ✅ Good - already theme-aware */
```

### Components Recently Updated
- `PayoutCountdownTimer.tsx` - Fixed separator border
- `FundingTransactionsTable.js` - Replaced hardcoded gray borders
- `SegmentedControl.tsx` - Converted to theme-aware styling
- `PWANotificationsAnalyticsWidget.tsx` - Updated admin component styling
- `PerformanceDashboard.tsx` - Fixed status color system
- `SimilarPages.js` - Removed redundant dark mode classes

## 🔍 **Migration Commands**

### Find Remaining Issues
```bash
# Search for hardcoded border colors
grep -r "border-gray\|border-neutral\|border-slate" app/ --include="*.tsx"

# Search for manual dark mode borders
grep -r "dark:border-" app/ --include="*.tsx"

# Search for border-current patterns
grep -r "border-current/" app/ --include="*.tsx"
```

### Automated Replacements
```bash
# Common border replacements
sed -i 's/border-gray-200/border-theme-medium/g' **/*.tsx
sed -i 's/border-gray-300/border-theme-strong/g' **/*.tsx
sed -i 's/border border-gray-400/border-theme-strong/g' **/*.tsx
```

## 🔗 **Related Documentation**

- [Border Styling Guidelines](./BORDER_STYLING_GUIDELINES.md)
- [Deprecated UI Patterns](./DEPRECATED_UI_PATTERNS.md)
- [Content Display Architecture](./CONTENT_DISPLAY_ARCHITECTURE.md)
- [Legacy Code Cleanup Guide](./LEGACY_CODE_CLEANUP_GUIDE.md)
