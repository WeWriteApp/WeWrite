# Click-to-Edit Links Implementation

## Overview
Implemented comprehensive click-to-edit functionality for all links in the WeWrite editor, including the missing "Show author" toggle for compound links.

## Features Implemented

### 1. ✅ Click-to-Edit for All Link Types
- **External links**: Click opens link editor with URL and display text pre-populated
- **Page links**: Click opens link editor with page title and custom text pre-populated  
- **User links**: Click opens link editor with username pre-populated
- **Compound links**: Click opens link editor with page title, author, and show author toggle enabled

### 2. ✅ Show Author Toggle (Previously Missing)
- **Added missing toggle** in WeWrite pages tab: "Show author"
- **Creates compound links** with format: `[Page Title] by [Author Username]`
- **Two clickable pills**: Both page title and author username are individually clickable
- **Proper state management**: Toggle state is preserved during editing

### 3. ✅ Modal Pre-population
- **External links**: URL field and custom text (if different from URL)
- **Page links**: Search field with current page title, custom text toggle enabled
- **Compound links**: Page title, custom text toggle enabled, show author toggle enabled
- **Proper tab selection**: Automatically switches to correct tab (page vs external)

### 4. ✅ Link Update vs Insert
- **Edit mode**: Updates existing link in place using `element.outerHTML`
- **Insert mode**: Creates new link at cursor position
- **State management**: `editingLink` state tracks which link is being edited
- **Modal title**: Changes from "Insert Link" to "Edit Link" based on mode

## Technical Implementation

### State Management
```typescript
// New state for editing existing links
const [editingLink, setEditingLink] = useState<{
  element: HTMLElement;
  type: 'page' | 'user' | 'external' | 'compound';
  data: any;
} | null>(null);

// New state for show author toggle (compound links)
const [showAuthorToggle, setShowAuthorToggle] = useState(false);
```

### Click Handler
```typescript
const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.target as HTMLElement;
  const linkElement = target.closest('[data-link-type]') as HTMLElement;
  
  if (linkElement) {
    e.preventDefault();
    e.stopPropagation();
    
    // Extract link data and open editor for editing
    openLinkEditorForEdit(linkData);
  }
}, [isClient]);
```

### Compound Link Creation
```typescript
if (showAuthorToggle || (editingLink && editingLink.type === 'compound')) {
  // Create compound link: [Page Title] by [Author Username]
  linkHTML = `<span class="compound-link" data-page-id="${item.id}" data-author="${authorUsername}">`;
  linkHTML += `<span class="${pillStyleClasses} page-link" data-link-type="page" data-id="${item.id}">${displayText}</span>`;
  linkHTML += ` <span class="text-muted-foreground text-sm">by</span> `;
  linkHTML += `<span class="${pillStyleClasses} user-link" data-link-type="user" data-id="${authorUsername}">${authorUsername}</span>`;
  linkHTML += `</span>`;
}
```

## UI Changes

### WeWrite Pages Tab
```
┌─────────────────────────────────────┐
│ Show author                    [○]  │  ← NEW: Creates compound links
├─────────────────────────────────────┤
│ Custom link text               [●]  │  ← Existing
├─────────────────────────────────────┤
│ [Custom text input field]           │  ← Existing
├─────────────────────────────────────┤
│ [Search results]                    │  ← Existing
└─────────────────────────────────────┘
```

### Modal Behavior
- **Title**: "Insert Link" vs "Edit Link" based on mode
- **Button**: "Create Link" vs "Update Link" based on mode
- **Pre-population**: All fields filled with current link data when editing
- **Reset**: All state cleared when modal closes

## Link Types Supported

### 1. External Links
- **Format**: `<span class="external-link" data-link-type="external" data-url="...">`
- **Click behavior**: Opens with URL and display text pre-filled
- **Update**: Replaces existing link with new URL/text

### 2. Page Links (Simple)
- **Format**: `<span class="page-link" data-link-type="page" data-id="...">`
- **Click behavior**: Opens with page title pre-filled
- **Update**: Replaces with new page selection

### 3. Compound Links (Page + Author)
- **Format**: `<span class="compound-link" data-page-id="..." data-author="...">`
- **Contains**: Page pill + "by" text + Author pill
- **Click behavior**: Opens with show author toggle enabled
- **Update**: Recreates entire compound structure

### 4. User Links
- **Format**: `<span class="user-link" data-link-type="user" data-id="...">`
- **Click behavior**: Opens with username pre-filled
- **Update**: Replaces with new user selection

## Testing Checklist

### Basic Click-to-Edit
- [ ] Click external link opens modal with URL pre-filled
- [ ] Click page link opens modal with title pre-filled  
- [ ] Click user link opens modal with username pre-filled
- [ ] Click compound link opens modal with show author enabled

### Show Author Toggle
- [ ] Toggle creates compound links with "by" format
- [ ] Both page and author parts are clickable
- [ ] Editing compound link preserves author information
- [ ] Toggle state resets when modal closes

### Modal Behavior
- [ ] Modal title changes between "Insert" and "Edit"
- [ ] Button text changes between "Create" and "Update"
- [ ] Correct tab opens based on link type
- [ ] All fields reset when modal closes

### Link Updates
- [ ] External link updates preserve position in text
- [ ] Page link updates work correctly
- [ ] Compound link updates maintain structure
- [ ] No duplicate links created during editing

## Known Limitations
- Requires page author information to be available in search results
- Compound links assume author username is available
- Click detection relies on `data-link-type` attributes
- Modal positioning uses React Portal (recently fixed)
