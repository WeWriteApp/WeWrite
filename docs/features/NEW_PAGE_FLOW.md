# New Page Flow

This document describes the behavior and requirements for the new page creation flow.

## Overview

When a user creates a new page, the experience is streamlined to focus on content creation. The new page flow uses a slide-up animation and hides distracting elements that aren't relevant until the page is saved.

## Entry Points

1. **FAB (Floating Action Button)** - Primary way to create new pages
2. **`/new` route** - Redirects to `/{pageId}?new=true` for backwards compatibility
3. **Reply flow** - Creating a reply to another page

## URL Structure

New pages use a pre-generated page ID with query parameters:

```
/{pageId}?new=true[&replyTo=...][&title=...][&ideas=true]
```

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| `new=true` | Indicates this is a new unsaved page |
| `replyTo` | Page ID being replied to |
| `page` | Title of the page being replied to (URL encoded) |
| `pageUsername` | Username of the page owner being replied to |
| `replyType` | Type of reply: `agree`, `disagree`, or `neutral` |
| `title` | Pre-filled page title |
| `ideas` | If `true`, show writing ideas banner |
| `customDate` | Pre-set custom date for the page |
| `location` | Pre-set location |
| `type` | Page type (e.g., `daily-note`) |

## UI Behavior

### New Page Mode

When `page.isNewPage` is `true`:

1. **Writing Ideas Banner** - Shows below the content editor to suggest topic ideas (unless it's a reply)
2. **Hidden Sections** - The following are hidden to focus on creation:
   - Page Graph View
   - What Links Here
   - Replies Section
   - Related Pages Section
   - Page Stats (views, edits, etc.)
   - Same Title Pages section
3. **Cancel Button** - Shows "Cancel" instead of "Delete" at the bottom
4. **Slide-up Animation** - New page slides up from the bottom

### After First Save

Once the page is saved for the first time:

1. `page.isNewPage` becomes `false`
2. All hidden sections become visible
3. "Cancel" button becomes "Delete"
4. Page URL changes from `?new=true` to regular page URL

## No Skeleton Loaders

Lazy-loaded components (PageGraphView, RepliesSection, RelatedPagesSection, WhatLinksHere) do NOT show skeleton loaders. This prevents jarring loading states for users scrolling down the page. The components simply render when ready.

## Implementation Details

### Key Files

- `app/components/pages/ContentPageView.tsx` - Main page component
- `app/components/writing/WritingIdeasBanner.tsx` - Topic suggestions component
- `app/new/page.tsx` - Legacy redirect handler
- `app/utils/pageId.ts` - `buildNewPageUrl()` function

### State Detection

The `page.isNewPage` flag is set on the page object and is used throughout ContentPageView to conditionally render sections:

```typescript
// Hide sections for new pages
{page && !page.isNewPage && (
  <div className="px-4 space-y-4">
    <PageGraphView ... />
    <RepliesSection ... />
    ...
  </div>
)}
```

### Writing Ideas Banner

The banner appears below the content editor for new pages (not replies):

```typescript
{isNewPageMode && page?.isNewPage && !page?.replyTo && (
  <WritingIdeasBanner
    onIdeaSelect={(title, placeholder) => handleTitleChange(title)}
    selectedTitle={title}
  />
)}
```

### Cancel vs Delete

The bottom button changes behavior based on page state:

```typescript
<Button
  variant={page.isNewPage ? "secondary" : "destructive"}
  onClick={page.isNewPage ? handleCancel : handleDelete}
>
  <Icon name={page.isNewPage ? "X" : "Trash2"} />
  <span>{page.isNewPage ? "Cancel" : "Delete"}</span>
</Button>
```

## Design Rationale

1. **Focus on Creation** - New pages should be distraction-free to encourage writing
2. **No Empty States** - Hiding sections with no data (0 views, 0 replies) avoids showing empty cards
3. **Clear Exit Path** - "Cancel" is clearer than "Delete" for an unsaved page
4. **Topic Suggestions** - Help users overcome writer's block when starting fresh
5. **Smooth Transitions** - Slide-up animation creates a modal-like experience while keeping users in context
