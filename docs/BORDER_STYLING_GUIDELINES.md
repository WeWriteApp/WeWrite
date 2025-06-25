# WeWrite Border Styling Guidelines

## Overview

WeWrite uses a comprehensive theme-aware border system that automatically adapts to light mode, dark mode, and high contrast accessibility settings. This document outlines the proper usage of border utilities to ensure consistent styling across the application.

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

## 🔗 **Related Files**

- `app/globals.css` - Border utility definitions
- `app/providers/ThemeProvider.tsx` - Theme context
- `app/lib/utils.ts` - Interactive card utility
- `tailwind.config.ts` - Theme configuration

## 📞 **Support**

For questions about border styling or theme integration, refer to the existing implementations in:
- `app/components/ui/card.tsx`
- `app/components/ui/button.tsx`
- `app/components/subscription/TokenAllocationBreakdown.tsx`
