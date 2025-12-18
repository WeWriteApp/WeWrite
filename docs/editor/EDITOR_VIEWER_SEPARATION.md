# Editor and Viewer Component Separation

## Overview

WeWrite now has a clear separation between editing and viewing components to improve maintainability, user experience, and code clarity. This document outlines the new architecture and usage patterns.

## Component Architecture

### 🖊️ **Editor Components** (Editing Experience)
- **Purpose**: Pure editing experience with input-style borders and editing features
- **Location**: `app/components/editor/`
- **Key Components**:
  - `Editor.tsx` - Main editor entry point (canonical Slate.js implementation)

**Features**:
- ✅ Input-style border and background for clear editing context
- ✅ Always in normal mode (no dense mode during editing)
- ✅ Rich text editing with inline links
- ✅ Save/Cancel/Delete actions
- ✅ Toolbar and editing controls
- ✅ Proper focus states and cursor handling

### 👁️ **Viewer Components** (Viewing Experience)
- **Purpose**: Clean, distraction-free content viewing without editor styling
- **Location**: `app/components/viewer/`
- **Key Components**:
  - `ContentViewer.tsx` - Pure content viewing component
  - `DenseModeToggle.tsx` - Switch control for normal and dense viewing modes

**Features**:
- ✅ No borders or input styling - pure content display
- ✅ Dense mode switch for compact reading (positioned below content)
- ✅ Clean typography and spacing
- ✅ Link navigation (not editing)
- ✅ Line numbers for reference
- ✅ Responsive design

## Usage Patterns

### When to Use Editor
```tsx
// For editing content (user owns the page and is in edit mode)
<Editor
  initialContent={content}
  onChange={handleChange}
  onSave={handleSave}
  onCancel={handleCancel}
  // ... other editing props
/>
```

### When to Use ContentViewer
```tsx
// For viewing content (reading other users' pages or viewing mode)
<div className="space-y-4">
  <ContentViewer
    content={content}
    showLineNumbers={true}
    showDiff={false}
  />

  {/* Dense mode toggle below content */}
  <div className="flex justify-center pt-4 border-t border-border/50">
    <DenseModeToggle />
  </div>
</div>
```

## Key Differences

| Aspect | Editor | ContentViewer |
|--------|--------|---------------|
| **Borders** | ✅ Input-style border | ❌ No borders |
| **Background** | ✅ Card background | ❌ Transparent |
| **Dense Mode** | ❌ Always normal | ✅ Switch below content |
| **Hover Effects** | ✅ Edit indicators | ❌ Clean viewing |
| **Line Numbers** | ✅ For editing | ✅ For reference |
| **Links** | ✅ Editable pills | ✅ Navigation only |
| **Purpose** | Editing content | Viewing content |

## Migration Guide

### Before (Mixed Concerns)
```tsx
// Old approach - TextView handled both editing and viewing
<TextView
  content={content}
  canEdit={canEdit}
  isEditing={isEditing}
  setIsEditing={setIsEditing}
  // Mixed editing/viewing props
/>
```

### After (Separated Concerns)
```tsx
// New approach - Clear separation
{shouldUseEditor ? (
  <Editor
    initialContent={content}
    onChange={handleChange}
    onSave={handleSave}
    // Pure editing props
  />
) : (
  <div className="space-y-4">
    <div className="flex justify-end">
      <DenseModeToggle />
    </div>
    <ContentViewer
      content={content}
      // Pure viewing props
    />
  </div>
)}
```

## Benefits of Separation

### 🎯 **Clarity**
- Clear distinction between editing and viewing modes
- No mixed concerns or confusing prop combinations
- Easier to understand and maintain

### 🎨 **User Experience**
- Editor looks like an input (has borders, background)
- Viewer looks like content (clean, no borders)
- Dense mode toggle only available when viewing
- No accidental editing triggers

### 🛠️ **Maintainability**
- Separate components for separate concerns
- Easier to modify editing features without affecting viewing
- Cleaner prop interfaces
- Better testing isolation

### 📱 **Performance**
- Viewer component is lighter (no editing logic)
- Editor component focuses on editing performance
- Better code splitting opportunities

## CSS Classes

### Editor Styles
```css
.editor-container {
  /* Input-style appearance */
  border: theme border;
  background: card background;
  padding: consistent padding;
}
```

### Viewer Styles
```css
.content-viewer {
  /* Clean viewing appearance */
  background: transparent;
  border: none;
  padding: 0;
}

.viewer-paragraph {
  /* Clean paragraph styling */
  /* No hover effects or edit indicators */
}
```

## Context Integration

Both components integrate with `LineSettingsContext`:
- **Editor**: Always uses normal mode, ignores dense mode setting
- **ContentViewer**: Respects user's dense/normal mode preference
- **DenseModeToggle**: Only shows in viewing mode, hidden during editing

## Future Enhancements

### Planned Features
- [ ] Print-optimized viewer styles
- [ ] Export-specific viewer formatting
- [ ] Advanced typography options for viewer
- [ ] Editor-specific accessibility improvements
- [ ] Viewer-specific reading enhancements

### Migration Tasks
- [x] Create ContentViewer component
- [x] Create DenseModeToggle component
- [x] Update PageView to use new components
- [x] Add proper CSS styling
- [x] Update Editor to have input-style borders
- [x] Remove mixed concerns from TextView
- [ ] Update other components using TextView
- [ ] Add comprehensive tests
- [ ] Update Storybook documentation

## Testing

### Editor Testing
```tsx
// Test editing functionality
render(<Editor initialContent={content} onChange={mockChange} />);
// Test save, cancel, delete actions
// Test rich text editing features
```

### Viewer Testing
```tsx
// Test viewing functionality
render(<ContentViewer content={content} />);
// Test dense mode toggle
// Test link navigation
// Test responsive design
```

This separation provides a cleaner, more maintainable architecture while improving the user experience for both editing and viewing content.

## Related Documentation

- [Editor Requirements](./EDITOR_REQUIREMENTS.md) - Core editor requirements
- [Line Based Editor](./LINE_BASED_EDITOR.md) - Editor implementation details
- [Content Display Architecture](./CONTENT_DISPLAY_ARCHITECTURE.md) - Unified content display
- [Theme System Architecture](./THEME_SYSTEM_ARCHITECTURE.md) - Theme integration
