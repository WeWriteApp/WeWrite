# Save Header System Documentation

## Overview

The Save Header System provides users with persistent access to save and revert actions when editing pages. It consists of two main UI components that appear when there are unsaved changes:

1. **Top Save Header** (`StickySaveHeader`) - A green banner at the top of the page
2. **Bottom Save Card** (part of `PageFooter`) - A green card at the bottom of the content

## Architecture

### Core Components

#### 1. `StickySaveHeader` Component
**Location**: `app/components/layout/StickySaveHeader.tsx`

**Purpose**: Provides immediate access to save/revert actions while scrolling

**Key Features**:
- Smart positioning: pushes content down when at top, becomes overlay when scrolled
- Responsive layout: full-width buttons on mobile, right-aligned group on desktop
- No shadow for clean, high-contrast appearance
- Smooth animations with 300ms transitions

**Props**:
```typescript
interface StickySaveHeaderProps {
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isAnimatingOut?: boolean;
}
```

#### 2. Bottom Save Card (PageFooter)
**Location**: `app/components/pages/PageFooter.js` (lines 110-140)

**Purpose**: Provides save actions at the end of content with additional context

**Key Features**:
- Solid green background matching top header
- White save button, outlined revert button
- Descriptive text explaining unsaved changes
- Responsive button layout

### Supporting Systems

#### 3. `useUnsavedChanges` Hook
**Location**: `app/hooks/useUnsavedChanges.ts`

**Purpose**: Handles navigation interception and unsaved changes warnings

**Key Features**:
- Prevents accidental navigation when changes exist
- Browser beforeunload protection
- Modal dialog for navigation confirmation
- Save-and-navigate functionality

#### 4. Change Detection Logic
**Location**: `app/components/pages/PageView.tsx`

**Purpose**: Tracks when content or title changes occur

**Key State Variables**:
- `hasContentChanged`: Tracks editor content modifications
- `hasTitleChanged`: Tracks title modifications  
- `hasUnsavedChanges`: Combined state of all changes
- `saveSuccess`: Tracks successful save operations

## Data Flow

### 1. Change Detection
```
User edits content/title
    ↓
handleContentChange/handleTitleChange called
    ↓
hasContentChanged/hasTitleChanged set to true
    ↓
hasUnsavedChanges becomes true
    ↓
Save headers appear
```

### 2. Save Operation
```
User clicks Save button
    ↓
handleSave called
    ↓
isSaving set to true (disables buttons)
    ↓
API call to save page
    ↓
On success: reset all change flags
    ↓
hasUnsavedChanges becomes false
    ↓
Save headers disappear with animation
```

### 3. Revert Operation
```
User clicks Revert button
    ↓
handleCancel called
    ↓
Reset content/title to last saved state
    ↓
Reset all change flags
    ↓
hasUnsavedChanges becomes false
    ↓
Save headers disappear
```

## Responsive Behavior

### Mobile Layout (< md breakpoint)
- **Top Header**: Full-width buttons side by side using `flex-1`
- **Bottom Card**: Stacked buttons with full width

### Desktop Layout (≥ md breakpoint)  
- **Top Header**: Right-aligned button group with `ml-auto`
- **Bottom Card**: Centered horizontal button group

## Styling System

### Color Scheme
- **Background**: `bg-green-600` (solid green)
- **Save Button**: `bg-white text-green-600` (white with green text)
- **Revert Button**: `text-white border-white/30` (white outline)

### Button Consistency
- **Radius**: All buttons use `rounded-lg` consistently
- **Transitions**: 300ms ease-out for all animations
- **States**: Proper disabled states during save operations

### Positioning Logic
- **At top of page**: `shouldPushContent = true` → content gets padding
- **When scrolled**: `shouldPushContent = false` → header becomes overlay
- **CSS Classes**: `has-sticky-save-header` applied to body for layout adjustments

## CSS Integration

### Global Styles (`app/globals.css`)
```css
/* Push main header down when save header present */
.has-sticky-save-header header[data-component="main-header"] {
  top: 56px !important;
  transition: top 300ms ease-in-out;
}

/* Push page headers in edit mode */
.has-sticky-save-header .page-header-edit-mode {
  margin-top: 56px;
  transition: margin-top 300ms ease-in-out;
}
```

### Content Spacing
The `PageView` component dynamically adjusts `contentPaddingTop` based on:
- Edit mode vs view mode
- Presence of unsaved changes
- Scroll position

## Future Improvements

### Potential Refactoring Opportunities
1. **Centralized State Management**: Move save state to a context provider
2. **Component Composition**: Extract common button groups into reusable components
3. **Animation System**: Create a unified animation system for all save UI
4. **Accessibility**: Add ARIA labels and keyboard navigation
5. **Testing**: Add comprehensive unit and integration tests

### Performance Optimizations
1. **Scroll Throttling**: Throttle scroll event handlers
2. **Memoization**: Memoize expensive calculations
3. **CSS Containment**: Use CSS containment for better performance

## Usage Examples

### Basic Implementation
```tsx
<StickySaveHeader
  hasUnsavedChanges={hasUnsavedChanges}
  onSave={handleSave}
  onCancel={handleCancel}
  isSaving={isSaving}
  isAnimatingOut={saveSuccess && !hasUnsavedChanges}
/>
```

### With Navigation Protection
```tsx
const {
  showUnsavedChangesDialog,
  handleNavigation,
  handleStayAndSave,
  handleLeaveWithoutSaving
} = useUnsavedChanges(hasUnsavedChanges, handleSave);
```

## Troubleshooting

### Common Issues
1. **Save header not appearing**: Check `hasUnsavedChanges` state
2. **Layout shifts**: Verify CSS transitions are properly configured
3. **Button not working**: Check if `isSaving` is properly managed
4. **Scroll behavior**: Ensure scroll event listeners are attached

### Debug Tools
- Console logs in `handleContentChange` and `handleSave`
- React DevTools for state inspection
- Browser DevTools for CSS debugging
