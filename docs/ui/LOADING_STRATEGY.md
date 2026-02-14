# WeWrite Loading Strategy

## Overview

This document outlines WeWrite's modern loading strategy that prioritizes perceived performance and user experience over traditional loading spinners.

## Problems Solved

### 1. Off-Center Loading States
**Issue**: Loading spinners were appearing off-center due to layout conflicts with `SidebarLayout` pushing content to account for the desktop sidebar.

**Solution**: Updated `UnifiedLoader` to use viewport-based centering (`50vw`, `50vh` with `translate(-50%, -50%)`) instead of `fixed inset-0` positioning. This ensures perfect centering regardless of parent layout constraints.

### 2. Poor Perceived Performance
**Issue**: Full-page loading spinners create a jarring experience where users see nothing until everything is ready.

**Solution**: Implemented progressive loading strategy that shows UI structure immediately while content loads in the background.

## New Loading Architecture

### 1. Progressive Loading Components

#### `ProgressiveLoader`
- Shows skeleton UI immediately (no delay)
- Maintains page structure to prevent layout shifts
- Smoothly transitions to real content when ready
- Configurable minimum skeleton display time to prevent flashing

#### `ProgressivePageLoader`
- Page-level wrapper with common skeleton patterns
- Built-in skeletons for: page, list, table, custom
- Automatic header and navigation skeletons
- Highly configurable for different page types

### 2. Updated Core Components

#### `UnifiedLoader` (Fixed Centering)
```tsx
// Before: Off-center due to layout conflicts
className="fixed inset-0 ..."

// After: Perfect viewport centering
style={{
  left: '50vw',
  top: '50vh',
  transform: 'translate(-50%, -50%)',
  // ...
}}
```

#### `ClientOnlyPageWrapper` (Progressive Loading)
```tsx
// Before: Loading spinner during hydration
<UnifiedLoader isLoading={true} message="Loading page..." />

// After: Progressive skeleton loading
<ProgressivePageLoader isLoading={true} skeletonType="page">
  {children}
</ProgressivePageLoader>
```

### 3. Implementation Examples

#### Random Pages
- Shows complete page structure skeleton during hydration
- Includes navigation header, page title, controls, and content skeletons
- Loads actual content progressively without blocking UI

#### Page View
- Shows page structure skeleton immediately
- Includes header navigation and content area skeletons
- Transitions smoothly to real content when loaded

## Loader Animation Rules

### 1. PulseLoader Has Built-In Animation
The `<Icon name="Loader" />` component renders a PulseLoader with its own animation. **Never** add `animate-spin` or any other animation wrapper — doing so double-animates the icon (a pulse inside a spin).

### 2. Animation Is Atomic, Not Molecular
Animation belongs inside the loader component itself, not applied by a parent container. This keeps loading behavior consistent and predictable across the app.

### 3. Always Use `Loader`, Not `Loader2`
Use `<Icon name="Loader" />` for all standard loading states. Do not use `Loader2` (a raw Lucide spinning icon) — it requires manual `animate-spin` and doesn't match the project's PulseLoader style.

### 4. RefreshCw with `animate-spin` Is Fine
`RefreshCw` with `animate-spin` is a deliberate UI choice for refresh buttons, not a loading indicator. This is acceptable.

### 5. Code Examples

```tsx
// CORRECT - PulseLoader animates on its own
<Icon name="Loader" size={24} />

// CORRECT - with additional styling (no animation classes)
<Icon name="Loader" size={16} className="mr-2" />

// WRONG - double animation (pulse + spin)
<Icon name="Loader" className="animate-spin" />

// WRONG - using Loader2 instead of Loader
<Icon name="Loader2" className="animate-spin" />

// OK - RefreshCw spinning is a deliberate refresh indicator
<Icon name="RefreshCw" className="animate-spin" />
```

## Best Practices

### 1. Skeleton-First Approach
- Always show skeleton UI immediately
- Never show blank screens or full-page spinners
- Match skeleton structure to actual content layout

### 2. Progressive Enhancement
- Load critical UI elements first
- Load secondary content progressively
- Maintain interactivity during loading

### 3. Smooth Transitions
- Use fade transitions between skeleton and content
- Minimum skeleton display time to prevent flashing
- Consistent animation timing across components

### 4. Layout Stability
- Skeleton dimensions should match real content
- Prevent cumulative layout shift (CLS)
- Maintain scroll position during transitions

## Migration Guide

### For New Components
```tsx
import { ProgressivePageLoader } from '../ui/progressive-loader';

function MyPage() {
  const [isLoading, setIsLoading] = useState(true);
  
  return (
    <ProgressivePageLoader
      isLoading={isLoading}
      skeletonType="list" // or 'page', 'table', 'custom'
    >
      {/* Your actual content */}
    </ProgressivePageLoader>
  );
}
```

### For Existing Components
1. Replace `UnifiedLoader` with `ProgressiveLoader` or `ProgressivePageLoader`
2. Create appropriate skeleton that matches your content structure
3. Ensure loading states don't block UI rendering
4. Test on different screen sizes and with sidebar expanded/collapsed

## Performance Benefits

1. **Immediate Visual Feedback**: Users see something instantly
2. **Reduced Perceived Load Time**: Skeleton gives impression of faster loading
3. **Better Core Web Vitals**: Improved CLS and LCP scores
4. **Enhanced UX**: No jarring transitions or blank screens
5. **Layout Stability**: Prevents content jumping and shifting

## Testing Checklist

- [ ] Loading states are perfectly centered on all screen sizes
- [ ] Skeleton structure matches actual content layout
- [ ] Smooth transitions between skeleton and content
- [ ] No layout shifts during loading
- [ ] Works with sidebar expanded and collapsed
- [ ] Mobile responsive behavior
- [ ] Accessibility considerations (screen readers)

## Future Enhancements

1. **Smart Preloading**: Preload content based on user behavior
2. **Adaptive Skeletons**: Dynamic skeleton generation based on content type
3. **Loading Analytics**: Track loading performance and user experience
4. **Offline Support**: Progressive loading with cached content
