# Link Cursor Behavior in WeWrite Editor

## Overview

Links in the WeWrite editor now behave as atomic units, similar to how they work in professional word processors like Google Docs or Microsoft Word. This means the cursor can only be positioned **before** or **after** a link, never inside it.

## Behavior Specification

### Single Click Behavior

When you click on a link:

- **Left half click**: Positions cursor **before** the link
- **Right half click**: Positions cursor **after** the link
- **Never**: Places cursor inside the link text

### Link Selection

To select an entire link for editing:

- **Double-click** on the link
- **Shift + click** on the link  
- **Cmd/Ctrl + click** on the link

When a link is selected:
- The entire link is highlighted
- You can press **Enter** to open the link editor
- Arrow keys move the cursor to before/after the link

### Keyboard Navigation

#### Arrow Keys

- **Left/Right arrows**: When cursor is near a link, moves cursor to before/after the link as a single unit
- **Up/Down arrows**: When a link is selected, moves cursor to edge of link then continues normal line navigation

#### Enter Key

- When a link is **selected** (highlighted), pressing **Enter** opens the link editor
- When cursor is just positioned near a link, **Enter** creates a new line normally

### Link Types Supported

All link types behave atomically:

- **Page links**: `[Page Title](page:pageId)`
- **User links**: `[@username](user:userId)` 
- **External links**: `[Link Text](https://example.com)`
- **Compound links**: Page + author attribution

## Technical Implementation

### CSS Properties

Links have these key CSS properties for atomic behavior:

```css
[contenteditable] .page-link,
[contenteditable] .user-link, 
[contenteditable] .external-link,
[contenteditable] .compound-link {
  /* Prevent text selection within links */
  user-select: none !important;
  
  /* Show pointer cursor */
  cursor: pointer !important;
  
  /* Treat as atomic units */
  display: inline-block !important;
  
  /* Prevent direct editing */
  contenteditable: false;
}
```

### JavaScript Event Handling

#### Click Handler

```javascript
const handleEditorClick = (e) => {
  const linkElement = e.target.closest('[data-link-type], .compound-link');
  
  if (linkElement) {
    e.preventDefault();
    
    const linkRect = linkElement.getBoundingClientRect();
    const clickX = e.clientX;
    const linkCenterX = linkRect.left + linkRect.width / 2;
    
    // Check for selection clicks
    const isSelectionClick = e.detail === 2 || e.shiftKey || e.metaKey || e.ctrlKey;
    
    if (isSelectionClick) {
      // Select entire link
      const range = document.createRange();
      range.selectNode(linkElement);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Position cursor before/after based on click position
      const range = document.createRange();
      if (clickX < linkCenterX) {
        range.setStartBefore(linkElement);
      } else {
        range.setStartAfter(linkElement);
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
};
```

#### Keyboard Handler

```javascript
const handleKeyDown = (e) => {
  // Enter key on selected links
  if (e.key === 'Enter') {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const linkElement = findSelectedLink(selection);
      if (linkElement && isEntireLinkSelected(selection, linkElement)) {
        e.preventDefault();
        openLinkEditor(linkElement);
        return;
      }
    }
  }
  
  // Arrow key navigation
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const linkElement = findNearbyLink(selection);
    if (linkElement) {
      e.preventDefault();
      const range = document.createRange();
      if (e.key === 'ArrowLeft') {
        range.setStartBefore(linkElement);
      } else {
        range.setStartAfter(linkElement);
      }
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
};
```

## User Experience Benefits

1. **Consistent Behavior**: Links behave like atomic objects, similar to images or other embedded content
2. **No Accidental Editing**: Users can't accidentally edit link text when they meant to position the cursor
3. **Clear Intent**: Separate actions for cursor positioning vs. link editing
4. **Professional Feel**: Matches behavior of established word processors

## Migration Notes

This change is backward compatible:
- Existing links continue to work normally
- Link editing functionality is preserved
- Only cursor positioning behavior has changed
- All link types (page, user, external, compound) are supported

## Testing

Run the link cursor behavior tests:

```javascript
// In browser console
runAllLinkCursorTests();
```

Or load the test file:

```html
<script src="/test/linkCursorBehaviorTest.js"></script>
```
