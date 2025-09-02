# WeWrite Link System

## Overview

The WeWrite link system provides automatic title updates while respecting user customization. This document describes the clean, maintainable architecture that replaced the previous complex system.

## Core Principles

1. **Simple Data Structure**: Clear separation between auto-generated and custom text
2. **Automatic Updates**: Page title changes automatically update all links
3. **User Control**: Users can set custom text that won't be auto-updated
4. **No Maintenance Nightmares**: Clean, obvious code with descriptive naming
5. **Intuitive Editing**: When editing links, the current display text is pre-filled for easy customization

## Link Node Structure

```typescript
interface LinkNode {
  type: 'link';
  
  // Target page information
  pageId: string;
  pageTitle: string; // Current title of target page (always auto-updated)
  url: string; // URL path to the page
  
  // Display text logic
  isCustomText: boolean; // Whether user has set custom display text
  customText?: string; // User-provided custom text (only if isCustomText = true)
  
  // Slate.js structure
  children: Array<{ text: string }>; // The actual rendered text
}
```

## Display Logic

- **If `isCustomText = false`**: Show `pageTitle` (auto-updated when page title changes)
- **If `isCustomText = true`**: Show `customText` (never auto-updated)

## Editing Experience

When a user edits an existing link:

1. **Current Display Text**: The modal pre-fills with whatever text is currently being displayed
2. **Search Pre-filling**: For internal links, the search field is pre-populated with the current page title for easy replacement
3. **Custom Text Toggle**:
   - **Turning ON**: Uses current display text as starting point for customization
   - **Turning OFF**: Reverts to auto-generated page title (clears custom text)
4. **Live Updates**: Changes are immediately applied to the existing link in the editor
5. **Seamless Transition**: Users can easily switch between auto-generated and custom text modes

This ensures that users always see what they expect and can easily customize link text without losing context.

## Compound Links (Show Author)

Compound links display both the page title and author information:

1. **Page Link**: Standard page pill with custom or auto-generated text
2. **Author Attribution**: Uses UsernameBadge component with subscription status
3. **Efficient Data**: Leverages existing user data caching to avoid duplicate API calls
4. **Consistent Styling**: Follows the same design patterns as other UsernameBadge instances

## Technical Implementation Details

### Unified Link Processing Flow

1. **Data Extraction**: SlateEditor extracts current display text, link properties, and element path
2. **Modal Pre-filling**: LinkEditorModal receives both custom text and current display text
3. **Smart Defaults**: When custom text toggle is enabled, it uses the current display text as default
4. **Unified Processing**:
   - **Single `createLinkElement()` Function**: Creates consistent link elements for all scenarios
   - **Single `insertLink()` Handler**: Uses `Transforms.setNodes()` for both new and existing links
   - **Path-Based Updates**: Existing links updated at their stored path, new links inserted at selection
5. **Bidirectional Toggle**: Custom text can be enabled (with current text) or disabled (revert to page title)

### Key Technical Features

- **currentDisplayText**: Always passed to editing modal to show what user currently sees
- **isCustomText Detection**: Uses both explicit flag and text comparison for robust detection
- **Fallback Chain**: Multiple fallbacks ensure display text is never empty
- **Helper Functions**: Centralized logic in LinkNodeHelper and modal helpers for consistency
- **Efficient Caching**: UsernameBadge components use existing user data cache to prevent duplicate API calls
- **Search Pre-filling**: Editing modal pre-populates search with current page for easy replacement
- **No Autocomplete**: Input fields use `autoComplete="off"` to prevent browser suggestions for non-repeatable content
- **Unified Processing**: Single code path handles both new link creation and existing link updates

## Title Update System

When a page title changes:

1. **Auto-generated links** (`isCustomText = false`):
   - `pageTitle` is updated to new title
   - `children[0].text` is updated to new title
   - Link displays new title automatically

2. **Custom text links** (`isCustomText = true`):
   - `pageTitle` is updated for reference
   - `customText` and `children[0].text` remain unchanged
   - Link continues to display user's custom text

## Helper Functions

### LinkNodeHelper

```typescript
// Create auto-updating link
LinkNodeHelper.createAutoLink(pageId, pageTitle, url)

// Create custom text link
LinkNodeHelper.createCustomLink(pageId, pageTitle, url, customText)

// Update page title (respects custom text)
LinkNodeHelper.updatePageTitle(link, newPageTitle)

// Convert to custom text
LinkNodeHelper.setCustomText(link, customText)

// Convert back to auto-generated
LinkNodeHelper.removeCustomText(link)
```

### Migration

The system automatically migrates old link formats:

```typescript
// Old messy format with text, displayText, originalPageTitle, etc.
// Gets converted to clean LinkNode structure
LinkMigrationHelper.migrateOldLink(oldLink)
```

## Implementation Files

- **`/app/types/linkNode.ts`**: Clean data structure and helper functions
- **`/app/api/pages/route.ts`**: Title update system with migration
- **`/app/components/editor/SlateEditor.tsx`**: Link creation and editing logic
- **`/app/components/editor/LinkEditorModal.tsx`**: UI for creating/editing links with smart pre-filling
- **`/app/components/editor/LinkNode.tsx`**: Link rendering with proper display text extraction

## Code Quality & Efficiency

### Recent Improvements

1. **Unified Link Processing**: Single `createLinkElement()` function handles all link creation scenarios
2. **Simplified Update Logic**: Both new and existing links use the same `Transforms.setNodes()` pattern
3. **Helper Functions**: Created `createLinkData()` and `getDefaultDisplayText()` to eliminate code duplication
4. **Consistent Data Flow**: Standardized how authorUserId is passed through the system
5. **UsernameBadge Integration**: Replaced separate user pills with efficient UsernameBadge components
6. **Search Pre-filling**: Enhanced editing experience with intelligent search pre-population

### Performance Optimizations

- **Shared Caching**: UsernameBadge components leverage existing user data cache
- **Reduced API Calls**: No duplicate subscription status requests
- **Efficient Rendering**: Compound links use optimized component structure

## Benefits

1. **Maintainable**: Clear separation of concerns, obvious naming, reduced code duplication
2. **Reliable**: Simple logic that's easy to debug with consistent helper functions
3. **User-Friendly**: Respects user customization while providing automation and intuitive editing
4. **Efficient**: Optimized API usage and shared caching prevent unnecessary requests
5. **Future-Proof**: Clean architecture that's easy to extend

## Migration Strategy

The system automatically migrates old links when encountered:

1. Detects old format (missing `isCustomText` field)
2. Analyzes display text vs page title to determine if custom
3. Converts to clean structure
4. Removes old confusing fields

This ensures backward compatibility while cleaning up the data over time.
