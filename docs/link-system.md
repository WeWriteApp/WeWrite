# WeWrite Link System

## Overview

The WeWrite link system provides automatic title updates while respecting user customization. This document describes the clean, maintainable architecture that replaced the previous complex system.

## Core Principles

1. **Simple Data Structure**: Clear separation between auto-generated and custom text
2. **Automatic Updates**: Page title changes automatically update all links
3. **User Control**: Users can set custom text that won't be auto-updated
4. **No Maintenance Nightmares**: Clean, obvious code with descriptive naming

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
- **`/app/components/editor/SlateEditor.tsx`**: Link creation using helpers
- **`/app/components/editor/LinkEditorModal.tsx`**: UI for creating/editing links

## Benefits

1. **Maintainable**: Clear separation of concerns, obvious naming
2. **Reliable**: Simple logic that's easy to debug
3. **User-Friendly**: Respects user customization while providing automation
4. **Future-Proof**: Clean architecture that's easy to extend

## Migration Strategy

The system automatically migrates old links when encountered:

1. Detects old format (missing `isCustomText` field)
2. Analyzes display text vs page title to determine if custom
3. Converts to clean structure
4. Removes old confusing fields

This ensures backward compatibility while cleaning up the data over time.
