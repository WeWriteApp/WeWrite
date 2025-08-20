# WeWrite Design System

## Floating Elements & Glassmorphism

### FloatingCard Component - Single Source of Truth

The `FloatingCard` component is the **single source of truth** for all glassmorphism styling in WeWrite. It replaces all legacy CSS classes and provides consistent styling across the entire application.

#### Usage

```tsx
import { FloatingCard, FloatingHeader, FloatingToolbar, FloatingOverlay, FloatingPledge } from '../ui/FloatingCard';

// Basic usage
<FloatingCard variant="default">Content</FloatingCard>

// Specialized variants (recommended)
<FloatingHeader withGradient={true}>Header content</FloatingHeader>
<FloatingToolbar isExpanded={false}>Navigation</FloatingToolbar>
<FloatingOverlay>Modal content</FloatingOverlay>
<FloatingPledge>Allocation bar</FloatingPledge>
```

#### Variants

- **`default`** - Standard glassmorphism for general floating elements
- **`header`** - For floating headers (FloatingFinancialHeader, etc.)
- **`toolbar`** - For mobile bottom navigation with expanded states
- **`overlay`** - For modals and overlays with stronger shadows
- **`pledge`** - For allocation bars with enhanced transparency

#### Design Tokens

All variants use consistent base styling:
- **Background**: `bg-white/15 dark:bg-black/15`
- **Backdrop blur**: `backdrop-blur-xl saturate-180`
- **Borders**: `border-white/20 dark:border-white/10`
- **Shadows**: `shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]`
- **Border radius**: `rounded-2xl`

### Migration from Legacy Classes

**DEPRECATED** - Do not use these CSS classes:
- ❌ `liquid-glass`
- ❌ `glass-overlay`
- ❌ `glass-pledge`

**RECOMMENDED** - Use FloatingCard variants:
- ✅ `<FloatingHeader>` instead of `liquid-glass`
- ✅ `<FloatingOverlay>` instead of `glass-overlay`
- ✅ `<FloatingPledge>` instead of `glass-pledge`

### Shadow System

All floating elements use consistent shadow values to ensure visual hierarchy:

1. **Standard floating elements**: `0_8px_32px_rgba(0,0,0,0.1)` (light) / `0_8px_32px_rgba(0,0,0,0.3)` (dark)
2. **Overlay elements**: `0_12px_40px_rgba(0,0,0,0.15)` (light) / `0_12px_40px_rgba(0,0,0,0.4)` (dark)
3. **Allocation bars**: `0_6px_24px_rgba(0,0,0,0.08)` (light) / `0_6px_24px_rgba(0,0,0,0.25)` (dark)

### CSS Protection

The design system includes CSS rules to prevent shadow removal from floating elements:

```css
/* Protects floating cards from shadow removal */
[data-floating-card] {
  /* Shadows are preserved */
}

/* Only removes shadows from actual sidebar elements */
[data-component="sidebar"]:not([data-floating-card]) {
  box-shadow: none;
}
```

## Cards & Containers

### New Centralized Card Theme System

WeWrite now uses a centralized card theme system based on Radix Colors. See [Theme System Documentation](./theme-system.md) for complete details.

#### Standard Cards

Use the universal card system:

```tsx
// Standard cards
<div className="wewrite-card">
  Content with consistent styling
</div>

// Floating glassmorphism cards
<div className="wewrite-card wewrite-floating">
  Floating content with blur effects
</div>

// Daily notes cards
<div className="wewrite-card wewrite-daily-notes">
  Daily notes content
</div>
```

#### Legacy Card Component

The `Card` component from `ui/card.tsx` has been updated to use the new system:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>
```

## Theme System

### Border Utilities

Consistent border styling across light/dark themes:

- `border-theme-light` - Subtle borders (20% opacity)
- `border-theme-strong` - Standard borders (60% opacity)
- `border-theme-solid` - Solid borders (100% opacity)

### Hover States

- `hover-border-light` - Light hover effect
- `hover-border-strong` - Standard hover effect
- `hover-border-solid` - Solid hover effect

## Maintenance Guidelines

### Adding New Floating Elements

1. **Always use FloatingCard** - Never create custom glassmorphism CSS
2. **Choose appropriate variant** - Use specialized variants when available
3. **Add data attributes** - Include `data-floating-card` for CSS protection
4. **Test in both themes** - Ensure light/dark mode compatibility

### Modifying Glassmorphism

1. **Edit FloatingCard component** - Single source of truth
2. **Update all variants** - Maintain consistency across variants
3. **Test shadow visibility** - Ensure shadows appear on all floating elements
4. **Update documentation** - Keep this file current

### CSS Rules to Avoid

- ❌ Never use `!important` modifiers
- ❌ Never create custom glassmorphism CSS classes
- ❌ Never remove shadows from `[data-floating-card]` elements
- ❌ Never use inline styles for glassmorphism effects

## Allocation System Integration

### Overfunded Allocation Display

When users allocate more than their available balance, the allocation bars now visually split the allocation into funded and overfunded portions:

#### Features:
- **Funded portion** - Shows in accent color (primary) representing funds that will actually be paid out
- **Overfunded portion** - Shows in orange representing funds that exceed the user's budget
- **"Out" indicator** - Shows in the top-left when user has exceeded their available funds
- **Visual feedback** - Users can see exactly how much is funded vs unfunded

#### Implementation:
The allocation bars automatically calculate and display:
- `currentPageFundedPercentage` - Portion that fits within the user's budget (accent color)
- `currentPageOverfundedPercentage` - Portion that exceeds the budget (orange color)

This encourages users to increase their subscription to fund the overfunded allocations.

## Future Improvements

### Planned Enhancements

1. **Design tokens** - Extract values to CSS custom properties
2. **Animation system** - Consistent transitions for floating elements
3. **Accessibility** - Enhanced focus indicators for glassmorphism
4. **Performance** - Optimize backdrop-filter usage

### Migration Tasks

1. **Audit remaining liquid-glass usage** - Replace with FloatingCard
2. **Consolidate glass CSS classes** - Remove deprecated classes
3. **Update component documentation** - Ensure all components use design system
4. **Create Storybook stories** - Document all FloatingCard variants
