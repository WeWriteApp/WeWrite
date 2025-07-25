# WeWrite Content Display Architecture

## Overview

This document describes the unified content display system for WeWrite, designed for maintainability, clarity, and consistent user experience. The system replaces multiple overlapping components with a clean, well-documented architecture.

## Architecture Principles

### 1. Single Responsibility
Each component has one clear purpose:
- `ContentDisplay`: Decides between editing and viewing modes
- `EditableContent`: Handles all editing functionality
- `ViewableContent`: Handles all viewing functionality

### 2. Clear Separation of Concerns
- **Editing**: Rich text editing, inline links, content changes
- **Viewing**: Clean reading experience, dense mode, navigation
- **Styling**: Centralized in `content-display.css` with clear naming

### 3. User Preferences Respected
- **No Borders**: Clean, borderless design throughout
- **Transparent Backgrounds**: Focus on content, not containers
- **Proper Text Colors**: Consistent foreground color inheritance

### 4. Maintainable Code
- **Clear Naming**: All classes follow `wewrite-*` convention
- **Comprehensive Documentation**: Every component and style documented
- **Centralized Logic**: No scattered conditional styling

## Component Architecture

```
ContentDisplay (Decision Layer)
├── EditableContent (Editing Mode)
│   └── SlateEditor (Rich Text Editing)
└── ViewableContent (Viewing Mode)
    └── ContentViewer (Clean Reading)
```

### ContentDisplay.tsx
**Purpose**: Single entry point for all content display
**Responsibilities**:
- Decides between editing and viewing modes
- Passes appropriate props to child components
- Maintains consistent API for parent components

**Usage**:
```tsx
<ContentDisplay
  content={pageContent}
  isEditable={canEdit}
  onChange={handleChange}
  // ... other props
/>
```

### EditableContent.tsx
**Purpose**: Pure editing component
**Responsibilities**:
- Rich text editing with Slate.js
- Inline link management
- Content change handling
- Editing-specific styling

**Key Features**:
- No borders (user preference)
- Transparent background
- Proper text color inheritance
- Clean, minimal appearance

### ViewableContent.tsx
**Purpose**: Pure viewing component
**Responsibilities**:
- Clean content viewing
- Dense/normal mode support
- Line numbers and navigation
- Diff viewing
- Search result highlighting

**Key Features**:
- No borders (clean viewing)
- Responsive design
- Focus on readability
- Link navigation (no editing)

## Styling Architecture

### File Structure
```
app/styles/content-display.css  # Unified styling system
app/globals.css                 # Global styles (legacy to be cleaned)
app/components/editor-styles.css # Editor-specific styles (legacy)
```

### CSS Class Naming Convention
All new classes follow the `wewrite-*` pattern:
- `wewrite-content-display`: Base content container
- `wewrite-editable-content`: Editing mode container
- `wewrite-viewable-content`: Viewing mode container
- `wewrite-editor-container`: Slate editor wrapper
- `wewrite-viewer-container`: Content viewer wrapper

### Styling Principles
1. **No Borders**: User preference - clean, borderless design
2. **Transparent Backgrounds**: Focus on content, not containers
3. **Proper Inheritance**: Text colors and spacing inherit correctly
4. **Responsive Design**: Works on all screen sizes
5. **Accessibility**: High contrast mode support

## Migration Guide

### From Old System
```tsx
// OLD: Complex conditional rendering
{shouldUseEditor ? (
  <Editor readOnly={!canEdit} {...props} />
) : (
  <ContentViewer {...props} />
)}

// NEW: Clean, simple API
<ContentDisplay
  isEditable={canEdit}
  content={content}
  onChange={handleChange}
  {...props}
/>
```

### CSS Class Migration
```css
/* OLD: Scattered, inconsistent naming */
.editor-container { /* ... */ }
.content-viewer-container { /* ... */ }
.page-editor-stable { /* ... */ }

/* NEW: Consistent, clear naming */
.wewrite-editor-container { /* ... */ }
.wewrite-viewer-container { /* ... */ }
.wewrite-content-display { /* ... */ }
```

## Benefits

### For Developers
1. **Easier Maintenance**: Single source of truth for content display
2. **Clear Responsibilities**: Each component has one job
3. **Better Testing**: Isolated components are easier to test
4. **Consistent API**: Same interface regardless of mode

### For Users
1. **Consistent Experience**: Same UX patterns throughout
2. **Better Performance**: Optimized rendering paths
3. **Accessibility**: Proper contrast and responsive design
4. **Clean Design**: No borders, focus on content

## Future Considerations

### Extensibility
The architecture supports easy addition of new features:
- New viewing modes (e.g., presentation mode)
- Enhanced editing features (e.g., collaborative editing)
- Additional content types (e.g., tables, media)

### Performance
- Components are optimized for React rendering
- CSS uses efficient selectors and inheritance
- No unnecessary re-renders or style calculations

### Accessibility
- High contrast mode support built-in
- Proper semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility

## Implementation Status

- [x] ContentDisplay component created
- [x] EditableContent component created
- [x] ViewableContent component created
- [x] Unified CSS styling system created
- [x] Comprehensive documentation written
- [x] PageView integration updated
- [x] SlateEditor updated with new CSS classes
- [x] ContentViewer updated with new CSS classes
- [ ] Legacy code cleanup
- [ ] Testing and validation

## Maintenance Guidelines

### Adding New Features
1. **Editing Features**: Add to `EditableContent.tsx` and related Slate components
2. **Viewing Features**: Add to `ViewableContent.tsx` and `ContentViewer.tsx`
3. **Styling**: Add to `content-display.css` with `wewrite-*` naming
4. **Documentation**: Update this file and component JSDoc comments

### Debugging Issues
1. **Check ContentDisplay**: Verify `isEditable` prop is correct
2. **Check CSS Classes**: Ensure new `wewrite-*` classes are applied
3. **Check Console**: Look for component selection logs in PageView
4. **Check Inheritance**: Verify text colors and spacing inherit properly

### Performance Optimization
1. **Memoization**: Use React.memo for stable components
2. **CSS Efficiency**: Use CSS inheritance over repeated declarations
3. **Bundle Size**: Keep components focused and avoid unnecessary imports
4. **Rendering**: Minimize re-renders with proper prop dependencies

### Code Quality Standards
1. **TypeScript**: All components must have proper TypeScript interfaces
2. **Documentation**: All public methods and props must be documented
3. **Testing**: New features require unit tests
4. **Accessibility**: All components must support keyboard navigation and screen readers
