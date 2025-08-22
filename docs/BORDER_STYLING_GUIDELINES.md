# WeWrite Border Styling Guidelines

## Overview

WeWrite uses a comprehensive theme-aware border system that automatically adapts to light mode, dark mode, and high contrast accessibility settings. This document outlines the proper usage of border utilities to ensure consistent styling across the application.

## 🎯 **NEW: Standardized Page Element Borders (2024)**

### Unified Border System for Page Elements
All page elements (title, body, footer sections) now use a standardized border system:

```css
/* Standard border states for page elements */
.border-muted-foreground/30     /* Inactive/default state */
.border-primary/50 ring-2 ring-primary/20  /* Active/focused state */
.border-destructive focus:ring-2 focus:ring-destructive/20  /* Error state */
```

### Standardized Padding System
All page elements use consistent padding:
```css
px-4    /* Horizontal padding: 16px (all page elements) */
py-2    /* Vertical padding for titles: 8px */
py-4    /* Vertical padding for body content: 16px */
```

## ✅ **ALWAYS USE** - Theme-Aware Border Classes

### Primary Border Classes
```css
.border-theme-light    /* Light border (20% opacity) */
.border-theme-medium   /* Medium border (40% opacity) */
.border-theme-strong   /* Strong border (60% opacity) */
.border-theme-solid    /* Solid border (100% opacity) */
```

### Interactive Hover States
```css
.hover-border-light    /* Light hover state (30% opacity) */
.hover-border-medium   /* Medium hover state (50% opacity) */
.hover-border-strong   /* Strong hover state (70% opacity) */
.hover-border-solid    /* Solid hover state (100% opacity) */
```

### Card System Integration
```css
/* CSS Variables for card borders */
--card-bg: rgba(255, 255, 255, 0.7)           /* Light mode card background */
--card-border: rgba(0, 0, 0, 0.08)            /* Light mode card border */
--card-border-hover: rgba(0, 0, 0, 0.12)      /* Light mode card border hover */

/* Dark mode equivalents */
--card-bg: rgba(20, 20, 20, 0.7)              /* Dark mode card background */
--card-border: rgba(255, 255, 255, 0.08)      /* Dark mode card border */
--card-border-hover: rgba(255, 255, 255, 0.12) /* Dark mode card border hover */

/* Usage in components */
.bg-[var(--card-bg)]                          /* Card background */
.border-[var(--card-border)]                  /* Card border */
.hover:border-[var(--card-border-hover)]      /* Card border hover */
```

### Divide Utilities
```css
.divide-theme-light      /* Light divider between elements */
.divide-theme-medium     /* Medium divider between elements */
.divide-theme-strong     /* Strong divider between elements */
.divide-theme-solid      /* Solid divider between elements */
```

### Directional Borders
```css
.border-t-only         /* Top border only */
.border-b-only         /* Bottom border only */
.border-r-only         /* Right border only */
.border-l-only         /* Left border only */
```

### Specialized Classes
```css
.glass-card           /* Card with subtle glass effect */
.glass-panel          /* Panel with more pronounced glass effect */
.wewrite-card         /* Standard card styling */
```

## ❌ **NEVER USE** - Hardcoded Border Classes

### Avoid These Classes
```css
/* ❌ DON'T USE - These don't adapt to themes */
.border-gray-200
.border-gray-300
.border-slate-300
.border-neutral-200
.border-zinc-300
.border              /* Generic border without theme awareness */

/* ❌ DON'T USE - Dark mode specific classes */
.dark:border-neutral-700
.dark:border-gray-700
```

## 📋 **Usage Examples**

### Basic Card
```jsx
// ✅ CORRECT
<div className="border-theme-strong rounded-xl shadow-sm p-4">
  Card content
</div>

// ❌ INCORRECT
<div className="border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4">
  Card content
</div>
```

### Interactive Card
```jsx
// ✅ CORRECT
<div className="border-theme-strong hover-border-strong rounded-xl shadow-sm p-4 transition-all duration-200">
  Interactive card content
</div>
```

### Modal/Dialog
```jsx
// ✅ CORRECT
<DialogContent className="border-theme-strong bg-card rounded-lg">
  Modal content
</DialogContent>

// ❌ INCORRECT
<DialogContent className="border border-border dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-lg">
  Modal content
</DialogContent>
```

### Form Elements
```jsx
// ✅ CORRECT - UI components already use theme-aware borders
<Button variant="outline">Button</Button>
<Input className="border-theme-medium" />

// ❌ INCORRECT
<input className="border border-gray-300 dark:border-gray-600" />
```

## 🎨 **Theme Integration**

### CSS Variables Used
```css
--border: 215 20% 85% (light mode) / 217.2 32.6% 25% (dark mode)
```

### High Contrast Mode
All border classes automatically adapt to high contrast mode when `data-high-contrast="true"` is set on the document element.

### Accessibility
- High contrast mode increases border opacity for better visibility
- Focus states use enhanced ring indicators
- All borders maintain proper contrast ratios

## 🔧 **Implementation Details**

### Border Opacity Levels
- **Light (20%)**: Subtle borders for minimal visual separation
- **Medium (40%)**: Standard borders for most UI elements
- **Strong (60%)**: Prominent borders for important elements
- **Solid (100%)**: Maximum contrast borders

### Responsive Behavior
All border classes work consistently across all screen sizes and don't require responsive variants.

### Performance
Theme-aware borders use CSS variables, ensuring optimal performance without JavaScript calculations.

## 🚨 **DEPRECATED PATTERNS - REMOVE DURING CLEANUP**

### ❌ Old Inconsistent Border Patterns (DELETE THESE)

#### Inconsistent Padding Patterns
```css
/* ❌ DELETE: Old inconsistent padding */
px-1 py-0.5    /* Old title padding - replace with px-4 py-2 */
px-2 py-1      /* Old hover padding - replace with px-4 py-2 */
px-3           /* Non-standard padding - replace with px-4 */
```

#### Inconsistent Border States
```css
/* ❌ DELETE: Old inconsistent border patterns */
border-muted-foreground/20     /* Old weak border - replace with /30 */
border-gray-300               /* Hardcoded color - use theme-aware */
border-neutral-200            /* Hardcoded color - use theme-aware */
dark:border-gray-600          /* Manual dark mode - use theme-aware */
```

#### Mixed Focus States
```css
/* ❌ DELETE: Inconsistent focus states */
focus:border-blue-500         /* Old focus color - use border-primary/50 */
focus:ring-1                  /* Weak ring - use ring-2 */
focus:ring-blue-200           /* Hardcoded ring - use ring-primary/20 */
```

### 🔍 Search Patterns for Cleanup

#### Find Inconsistent Padding
```bash
# Find old padding patterns that need standardization
grep -r "px-[123]" app/components/pages/ --include="*.tsx"
grep -r "py-0\.5\|py-1" app/components/pages/ --include="*.tsx"
```

#### Find Inconsistent Borders
```bash
# Find hardcoded border colors
grep -r "border-gray\|border-neutral" app/components/ --include="*.tsx"
grep -r "dark:border-" app/components/ --include="*.tsx"
grep -r "border-muted-foreground/20" app/components/ --include="*.tsx"
```

#### Find Inconsistent Focus States
```bash
# Find old focus patterns
grep -r "focus:border-blue\|focus:ring-blue" app/components/ --include="*.tsx"
grep -r "focus:ring-1[^0-9]" app/components/ --include="*.tsx"
```

## 🚨 **Migration Guide**

### Replacing Hardcoded Borders
```jsx
// Before
className="border border-gray-200 dark:border-gray-700"

// After
className="border-theme-medium"
```

### Common Replacements
```jsx
// Cards
"border border-gray-200" → "border-theme-strong"
"border-gray-300" → "border-theme-strong"
"border-slate-200" → "border-theme-medium"

// Subtle borders
"border-gray-100" → "border-theme-light"
"border-neutral-200" → "border-theme-medium"

// Strong borders
"border-gray-400" → "border-theme-solid"
"border-slate-400" → "border-theme-solid"
```

## 📝 **Code Review Checklist**

When reviewing code, check for:
- [ ] No hardcoded color border classes
- [ ] Proper use of theme-aware border utilities
- [ ] Consistent border styling across similar components
- [ ] Proper hover states for interactive elements
- [ ] No dark mode specific border overrides

## ✅ **Border System Consolidation Status (2024)**

### ✅ **COMPLETED** - Border System Fully Consolidated

The WeWrite border system has been successfully consolidated and is now fully theme-aware:

#### **Current System Status:**
- ✅ **Theme-aware utilities**: All border classes use CSS variables
- ✅ **Interactive states**: Hover states properly implemented
- ✅ **Directional borders**: Top, bottom, left, right utilities available
- ✅ **Glass effects**: Specialized glass-card and glass-panel classes
- ✅ **High contrast support**: Automatic accessibility enhancements
- ✅ **Card integration**: Seamless integration with card theme system
- ✅ **Divide utilities**: Consistent separators between elements

#### **Verification Results:**
```bash
# Hardcoded border patterns: ✅ CLEAN
grep -r "border-gray\|border-neutral\|border-slate" app/ --include="*.tsx"
# Result: Only 2 CSS utility classes remain (intentional)

# Border-current patterns: ✅ APPROPRIATE USAGE
grep -r "border-current" app/ --include="*.tsx"
# Result: 9 instances - all appropriate for loading spinners
```

#### **System Architecture:**
- **Base CSS Variables**: `--border` with theme-aware HSL values
- **Card Variables**: `--card-border` and `--card-border-hover` for card system
- **Opacity Levels**: 20%, 40%, 60%, 100% for different visual weights
- **High Contrast**: Automatic 2px borders and increased opacity
- **Performance**: CSS-only implementation, no JavaScript required

### Components Updated to Theme System
The following components were previously updated to use proper theme-aware borders:

- **PayoutCountdownTimer.tsx** - Fixed `border-current/20` → `border-border`
- **FundingTransactionsTable.js** - Fixed `border-gray-400` → `border-theme-strong`
- **SegmentedControl.tsx** - Fixed hardcoded gray borders → `border-theme-strong`
- **PWANotificationsAnalyticsWidget.tsx** - Fixed `border-gray-200` → `border-theme-strong`
- **PerformanceDashboard.tsx** - Fixed `border-gray-200` → `border-border`
- **SimilarPages.js** - Removed redundant `dark:border-border` classes
- **UnifiedSidebar.tsx** - Updated to use card border system
- **FloatingCard.tsx** - Enhanced with conditional styling for scroll states

## 🔗 **Related Files**

- `app/globals.css` - Border utility definitions
- `app/providers/ThemeProvider.tsx` - Theme context
- `app/lib/utils.ts` - Interactive card utility
- `tailwind.config.ts` - Theme configuration
- `docs/THEME_SYSTEM_ARCHITECTURE.md` - Complete theme system documentation

## 📞 **Support**

For questions about border styling or theme integration, refer to the existing implementations in:
- `app/components/ui/card.tsx`
- `app/components/ui/button.tsx`
- `app/components/subscription/TokenAllocationBreakdown.tsx`
