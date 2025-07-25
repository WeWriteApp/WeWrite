# Content Display Migration Guide

## Overview

This guide helps developers understand the migration from the old scattered content display system to the new unified architecture. Use this when working with existing code or when questions arise about architectural decisions.

## Before and After

### Old System (Complex, Scattered)
```tsx
// PageView.tsx - Complex conditional logic
{shouldUseEditor ? (
  <Editor
    readOnly={!canEdit}
    initialContent={content}
    onChange={handleChange}
    // ... many props
  />
) : (
  <div className="space-y-4">
    <ContentViewer
      content={content}
      showDiff={showDiff}
      showLineNumbers={true}
    />
    <div className="flex justify-center pt-4 border-t border-border/50">
      <DenseModeToggle />
    </div>
  </div>
)}
```

### New System (Clean, Unified)
```tsx
// PageView.tsx - Simple, clear logic
<ContentDisplay
  content={content}
  isEditable={canEdit}
  onChange={handleChange}
  showDiff={showDiff}
  showLineNumbers={true}
  // ... other props
/>
```

## Component Mapping

### Old Components → New Components
- `Editor.tsx` (wrapper) → **REMOVED** (redundant)
- `SlateEditor.tsx` → **UPDATED** (new CSS classes)
- `ContentViewer.tsx` → **UPDATED** (new CSS classes)
- `TextView.tsx` → **DEPRECATED** (use ContentViewer)
- Multiple conditional renders → `ContentDisplay.tsx` (unified)

### CSS Class Mapping
```css
/* Old Classes → New Classes */
.editor-container → .wewrite-editor-container
.content-viewer-container → .wewrite-viewer-container
.content-viewer → .wewrite-viewer-content
.page-editor-stable → .wewrite-content-display
```

## Key Architectural Changes

### 1. Single Entry Point
**Before**: Multiple components chosen via complex logic
**After**: Single `ContentDisplay` component handles all decisions

### 2. Clear Separation
**Before**: Editor and viewer logic mixed together
**After**: Completely separate `EditableContent` and `ViewableContent`

### 3. Consistent Styling
**Before**: Scattered CSS across multiple files
**After**: Centralized in `content-display.css` with clear naming

### 4. Better Props
**Before**: Different prop interfaces for different components
**After**: Unified prop interface with clear optional/required props

## Common Migration Tasks

### Updating Existing Pages
1. Replace complex conditional rendering with `ContentDisplay`
2. Update CSS class names to new `wewrite-*` convention
3. Remove redundant wrapper components
4. Simplify prop passing logic

### Adding New Features
1. **For Editing**: Add to `EditableContent` or `SlateEditor`
2. **For Viewing**: Add to `ViewableContent` or `ContentViewer`
3. **For Both**: Add to `ContentDisplay` with proper prop forwarding

### Debugging Issues
1. Check `isEditable` prop in `ContentDisplay`
2. Verify CSS classes are updated to new naming
3. Look for console logs in PageView component selection
4. Check that props are being passed correctly

## Breaking Changes

### Removed Components
- `Editor.tsx` (was just a wrapper around SlateEditor)
- Complex conditional logic in PageView

### Changed Interfaces
- `ContentDisplay` has unified prop interface
- Some props are now optional vs required depending on mode

### CSS Changes
- Old class names deprecated (but still work during transition)
- New `wewrite-*` naming convention required for new features

## Benefits Achieved

### For Developers
1. **Easier Debugging**: Single component to check for content display issues
2. **Clearer Code**: No more complex conditional rendering logic
3. **Better Testing**: Isolated components are easier to test
4. **Consistent API**: Same interface regardless of edit/view mode

### For Users
1. **Consistent UX**: Same behavior patterns throughout app
2. **Better Performance**: Optimized rendering paths
3. **Cleaner Design**: No borders, focus on content
4. **Accessibility**: Proper contrast and responsive design

## Rollback Plan

If issues arise, the old system can be temporarily restored:

1. Revert PageView.tsx to use conditional Editor/ContentViewer
2. Restore old CSS class names
3. Re-enable Editor.tsx wrapper component

However, the new system is designed to be more maintainable and should be preferred for long-term stability.

## Future Considerations

### Planned Improvements
1. **Performance**: Add React.memo optimizations
2. **Testing**: Comprehensive test suite for all components
3. **Accessibility**: Enhanced keyboard navigation and screen reader support
4. **Features**: New editing modes and viewing options

### Extension Points
The new architecture supports easy addition of:
- New content types (tables, media, etc.)
- New editing modes (collaborative, presentation, etc.)
- New viewing modes (print, export, etc.)
- Enhanced accessibility features

## Getting Help

### Documentation
- `CONTENT_DISPLAY_ARCHITECTURE.md` - Complete architecture overview
- Component JSDoc comments - Inline documentation
- CSS comments in `content-display.css` - Styling explanations

### Debugging
- Console logs in PageView show component selection logic
- React DevTools show component hierarchy and props
- CSS DevTools show applied styles and inheritance

### Code Review
When reviewing content display changes, check:
- [ ] Uses new `ContentDisplay` component
- [ ] Props are passed correctly for the mode
- [ ] CSS uses new `wewrite-*` class names
- [ ] No complex conditional rendering logic
- [ ] Proper TypeScript interfaces
