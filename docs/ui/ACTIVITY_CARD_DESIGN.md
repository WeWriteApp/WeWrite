# Activity Card Design System

## Overview

The ActivityCard is a reusable component that displays a single activity/edit event in a visually organized, chunked layout. It's used throughout the WeWrite app to show page edits, version history, and user activity.

**File Location**: `app/components/activity/ActivityCard.tsx`

## Visual Structure

The ActivityCard is organized into clearly defined sections for optimal visual hierarchy and UX:

```
┌─────────────────────────────────────────────────────┐
│ wewrite-card (main container)                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Section: Header (Title & Timestamp)             │ │
│ │ • Page title pill                               │ │
│ │ • Action text ("edited by", "created by")       │ │
│ │ • UsernameBadge with tier                       │ │
│ │ • Timestamp (relative time with tooltip)        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Section: Diff Preview (Changes)                 │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ bg-neutral-alpha-10 (sub-card)              │ │ │
│ │ │ • Diff stats (+X / -Y)                      │ │ │
│ │ │ • Text preview with highlighted changes     │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Section: Restore Actions (conditional)          │ │
│ │ • Restore button (version history only)         │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Section: Allocation Controls (conditional)      │ │
│ │ • Dollar allocation UI                          │ │
│ │ • Only shown for other users' content          │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Section Details

### 1. Header (Title & Timestamp)

**Hover tooltip**: "Section: Header (Title & Timestamp)"

**Purpose**: Provides context about what was changed and when

**Components**:
- Page title as a clickable PillLink
- Action text ("edited by", "created by", "renamed by")
- UsernameBadge with subscription tier
- Relative timestamp with absolute date tooltip

**Styling**:
```tsx
className="flex justify-between items-start w-full mb-3 cursor-pointer group/header"
```

**Key Features**:
- Full-width row layout
- Timestamp always on the right
- User info wraps naturally on mobile
- Click-to-navigate to page

### 2. Diff Preview (Changes)

**Hover tooltip**: "Section: Diff Preview (Changes)"

**Purpose**: Shows what content changed in the edit

**Components**:
- Sub-card container with `bg-neutral-alpha-10`
- DiffStats component (+X / -Y counter)
- DiffPreview component (text with highlighted changes)

**Styling**:
```tsx
<div className="bg-neutral-alpha-10 rounded-lg p-3">
```

**Key Features**:
- Visually separated from header using subtle background
- No shadows (inset look)
- Diff counter positioned at top of sub-card
- Text preview shows added (green) and removed (red) text
- Click-to-navigate to page

**Design Rationale**:
The sub-card creates visual chunking that groups related information (diff stats + preview) together. This improves scannability and reduces cognitive load.

### 3. Restore Actions

**Hover tooltip**: "Section: Restore Actions"

**Purpose**: Allows users to revert to a previous version

**Components**:
- Restore button with RotateCcw icon
- Loading state with spinner

**Visibility**:
```tsx
{canRestore && (
  // Only shows when:
  // - In activity/history context (versions page)
  // - Not the current version
  // - User is the page owner
)}
```

**Styling**:
```tsx
<Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
```

**Key Features**:
- Compact button design
- Right-aligned for easy access
- Disabled state while restoring
- Reloads page after successful restore

### 4. Allocation Controls

**Hover tooltip**: "Section: Allocation Controls"

**Purpose**: Allows users to financially support the author

**Components**:
- AllocationControls component
- Balance display
- Increment/decrement buttons

**Visibility**:
```tsx
{activity.userId && activity.pageId && (!user || user.uid !== activity.userId) && (
  // Only shows when viewing OTHER users' content
)}
```

**Styling**:
```tsx
className="w-full"
```

**Key Features**:
- Full-width for easy tapping on mobile
- Only shown for other users' pages
- Hides available balance text in carousel mode
- Source tracking for analytics

## Hover Tooltips

All sections have hover tooltips that display their name when you hover over them. This makes it easier to:

1. **Understand the card structure** during development
2. **Provide accurate prompts** when requesting changes (e.g., "move the timestamp to the diff section")
3. **Document the component** for new developers

**Implementation**:
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="group/section">
        {/* Section content */}
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs opacity-0 group-hover/section:opacity-100">
      Section: [Section Name]
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Styling System

### Container

Uses the universal card system:
```tsx
className="wewrite-card p-3 md:p-3"
```

### Diff Sub-Card

Uses neutral-alpha-10 for subtle separation:
```tsx
className="bg-neutral-alpha-10 rounded-lg p-3"
```

**Why neutral-alpha-10?**
- Provides subtle visual separation without being distracting
- Works in both light and dark themes
- Creates an "inset" look without heavy shadows
- Maintains the clean, minimalist design aesthetic

### Spacing

- **Container padding**: `p-3 md:p-3` (consistent across breakpoints)
- **Section spacing**: `mb-3` between sections
- **Internal padding**: `p-3` for sub-cards

### Interactive States

All sections are clickable and navigate to the appropriate page:
- Header → Navigate to page
- Diff preview → Navigate to page (or version page in history context)
- Restore button → Stops propagation (doesn't trigger navigation)
- Allocation controls → Embedded interaction (doesn't trigger navigation)

## Responsive Behavior

- **Mobile**: Stacks elements vertically, wraps user info naturally
- **Desktop**: Maintains horizontal layout where appropriate
- **Carousel mode**: Hides available balance text for compactness

## Props Interface

```tsx
interface ActivityCardProps {
  activity: Activity;          // Activity data object
  isCarousel?: boolean;        // Compact mode for carousels
  compactLayout?: boolean;     // Additional compactness
}
```

## Usage Examples

### Basic Activity Card

```tsx
<ActivityCard
  activity={activityData}
/>
```

### Carousel Mode

```tsx
<ActivityCard
  activity={activityData}
  isCarousel={true}
/>
```

## Design Principles

1. **Visual Chunking**: Related information is grouped together in sub-cards
2. **Clear Hierarchy**: Header → Content → Actions flow
3. **Minimalist Style**: No heavy shadows, subtle backgrounds
4. **Responsive**: Works on all screen sizes
5. **Accessible**: Hover tooltips, clear labels, keyboard navigation
6. **Theme-Aware**: Uses neutral-alpha colors that work in light/dark modes

## Implementation Notes

- Uses TooltipProvider for all tooltips
- Implements group hover states for section identification
- Maintains click handlers at appropriate levels
- Prevents event propagation where needed (restore button, allocation controls)
- Handles missing data gracefully

## Future Enhancements

Potential improvements to consider:

1. Drag-and-drop reordering in activity lists
2. Inline editing of titles
3. Quick actions menu (share, delete, etc.)
4. Activity filtering/grouping by type
5. Collapse/expand long diff previews
6. Real-time updates via WebSocket

---

**Last Updated**: 2025-12-08
**Author**: Claude Code
**Component**: ActivityCard.tsx
