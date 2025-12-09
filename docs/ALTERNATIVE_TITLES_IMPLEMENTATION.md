# Alternative Titles Implementation Plan

## Overview

This document outlines the architecture and implementation plan for the "Alternative Titles" feature in WeWrite. Alternative titles allow pages to have multiple searchable titles while maintaining a single primary display title. This is particularly useful for:

1. **Page Merging** - When two pages are merged, the old page's title can be retained as an alternative title
2. **SEO & Discoverability** - Pages can be found via multiple related search terms
3. **Disambiguation** - Common abbreviations or alternate names can point to the same page

## Requirements

### Functional Requirements

1. Each page has ONE primary display title (shown in header, search results, backlinks)
2. Each page can have ZERO or MORE alternative titles
3. Alternative titles are searchable just like primary titles
4. When a title header is selected/focused, it should:
   - Adjust height to wrap around the text (already implemented)
   - Expand to show a "Title settings" button below the title
5. "Title settings" button opens a modal (desktop) / drawer (mobile) containing:
   - Primary title display (editable)
   - List of alternative titles with ability to:
     - Add new alternative titles
     - Remove existing alternative titles
     - Promote an alternative title to primary (swaps positions)
6. Alternative titles must be unique within a page (no duplicates)
7. Alternative titles cannot match the primary title

### Non-Functional Requirements

1. Search performance should not significantly degrade with alternative titles
2. Alternative titles should be indexed for efficient searching
3. UI should be intuitive and consistent with existing WeWrite patterns

## Architecture

### Database Schema Changes

#### Page Document (Firestore)

```typescript
// In app/types/database.ts - Page interface
export interface Page {
  id: string;
  title: string;                    // Primary display title (existing)
  alternativeTitles?: string[];     // NEW: Array of alternative titles
  // ... existing fields ...
}
```

#### Search Index Considerations

For efficient searching, we have two options:

**Option A: Query-Time Search (Simpler, Less Efficient)**
- Search both `title` and `alternativeTitles` fields
- Use `array-contains` for alternative titles
- Pro: No additional collections needed
- Con: Cannot do prefix search on array elements in Firestore

**Option B: Denormalized Title Index (More Complex, More Efficient)**
- Create a separate `titleIndex` collection
- Each document maps a title (primary or alternative) to a page ID
- Pro: Efficient prefix searching on all titles
- Con: Need to maintain sync between page and index

**Recommended: Option A for MVP**, with Option B as a future optimization.

### Component Architecture

```
app/
├── components/
│   ├── pages/
│   │   ├── ContentPageHeader.tsx        # Modified: Add "Title settings" button
│   │   └── TitleSettingsModal.tsx       # NEW: Modal/drawer for title settings
│   └── ui/
│       └── adaptive-modal.tsx           # Existing: Reuse for responsive modal
├── firebase/
│   └── database/
│       └── pages.ts                     # Modified: Add alternative title CRUD
├── api/
│   └── pages/
│       └── search/
│           └── route.ts                 # Modified: Include alternative titles in search
└── types/
    └── database.ts                      # Modified: Add alternativeTitles to Page
```

### UI/UX Design

#### Title Header Interaction

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│            [Page Title Here]                        │  ← Title (auto-resizing textarea)
│                                                     │
│              ⚙️ Title settings                      │  ← Small button (shows on focus)
│                                                     │
│                  by username                        │  ← Byline
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### Title Settings Modal

```
┌─────────────────────────────────────────────────────┐
│  Title Settings                              [X]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Primary Title                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ My Page Title                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Alternative Titles                                 │
│  These titles can also be used to find this page   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Alternate Name                    [↑] [✕]   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ Another Alias                     [↑] [✕]   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ + Add alternative title...                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│                                      [Save]         │
│                                                     │
└─────────────────────────────────────────────────────┘

Legend:
[↑] = Promote to primary (swaps with current primary)
[✕] = Remove alternative title
```

## Implementation Plan

### Phase 1: Database & Types

1. **Update Page type** (`app/types/database.ts`)
   - Add `alternativeTitles?: string[]` field to Page interface

2. **Update page creation** (`app/firebase/database/pages.ts`)
   - Initialize `alternativeTitles` as empty array or undefined

3. **Create alternative title CRUD functions** (`app/firebase/database/pages.ts`)
   ```typescript
   export async function addAlternativeTitle(pageId: string, title: string): Promise<void>
   export async function removeAlternativeTitle(pageId: string, title: string): Promise<void>
   export async function promoteAlternativeTitle(pageId: string, title: string): Promise<void>
   export async function setAlternativeTitles(pageId: string, titles: string[]): Promise<void>
   ```

### Phase 2: Search Integration

1. **Update search API** (`app/api/pages/search/route.ts`)
   - Modify search query to also match alternative titles
   - Return `matchedTitle` field indicating which title matched

2. **Update search UI** (optional enhancement)
   - Show which title matched in search results
   - Format: "Primary Title (also known as: Matched Alternative)"

### Phase 3: UI Components

1. **Create TitleSettingsModal** (`app/components/pages/TitleSettingsModal.tsx`)
   - Use `AdaptiveModal` for responsive modal/drawer
   - Primary title input (editable, syncs with parent)
   - List of alternative titles with actions
   - Add alternative title input
   - Validation (no duplicates, not same as primary)

2. **Modify ContentPageHeader** (`app/components/pages/ContentPageHeader.tsx`)
   - Add state for showing "Title settings" button
   - Show button below title when title is focused/being edited
   - Add click handler to open TitleSettingsModal
   - Pass necessary props to modal

### Phase 4: Page Merge Support (Future)

1. **Create merge page function** (`app/firebase/database/pages.ts`)
   ```typescript
   export async function mergePage(
     sourcePageId: string,
     targetPageId: string,
     keepSourceTitle: boolean
   ): Promise<void>
   ```

2. **Merge behavior:**
   - If `keepSourceTitle` is true, add source page title to target's alternative titles
   - Update all backlinks pointing to source to point to target
   - Option to merge content or discard
   - Soft-delete source page

## API Endpoints

### New Endpoints Needed

```
PATCH /api/pages/[id]/alternative-titles
Body: { action: 'add' | 'remove' | 'promote', title: string }

GET /api/pages/[id]
Response: { ...pageData, alternativeTitles: string[] }
```

## Migration Strategy

1. No migration needed - `alternativeTitles` is optional
2. Existing pages will have `undefined` alternative titles
3. UI treats `undefined` and `[]` the same (no alternative titles)

## Testing Checklist

- [ ] Add alternative title to page
- [ ] Remove alternative title from page
- [ ] Promote alternative title to primary
- [ ] Search finds page by primary title
- [ ] Search finds page by alternative title
- [ ] Cannot add duplicate alternative title
- [ ] Cannot add alternative title that matches primary
- [ ] Modal displays correctly on desktop
- [ ] Drawer displays correctly on mobile
- [ ] Title settings button appears on title focus
- [ ] Changes persist after page refresh

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `app/types/database.ts` | Modify | Add `alternativeTitles` to Page interface |
| `app/firebase/database/pages.ts` | Modify | Add CRUD functions for alternative titles |
| `app/api/pages/search/route.ts` | Modify | Include alternative titles in search |
| `app/api/pages/[id]/alternative-titles/route.ts` | New | API endpoint for managing alternative titles |
| `app/components/pages/TitleSettingsModal.tsx` | New | Modal/drawer component |
| `app/components/pages/ContentPageHeader.tsx` | Modify | Add title settings button and modal trigger |

## Open Questions

1. Should alternative titles be shown anywhere in the UI besides search results?
2. Should there be a limit on the number of alternative titles per page?
3. Should alternative titles have any character restrictions beyond what primary titles have?
4. For page merging: should users be able to merge any pages or only their own?

## Future Enhancements

1. **Title Index Collection** - For better search performance at scale
2. **Title History** - Track when titles (primary or alternative) were changed
3. **Redirect Support** - Deleted pages could redirect to a "canonical" page via alternative titles
4. **Admin Tools** - Bulk manage alternative titles across pages
