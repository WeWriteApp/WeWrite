# WeWrite Header System Documentation

## Overview

WeWrite uses a standardized two-header system to provide consistent navigation and user experience across the application.

## Header Types

### 1. NavHeader - Navigation Pages
**Purpose**: For navigation pages, settings, search, timeline, etc.
**File**: `app/components/layout/NavHeader.tsx`

**Design Specifications**:
- **Position**: Below status bar on second row
- **Left**: Back button (chevron + "Back" text on desktop)
- **Center**: WeWrite logo (clickable to go home)
- **Right**: Action button group (specific to each page)
- **No title text** - logo serves as the identifier
- **No icons** in any text elements

**Layout Structure**:
```
[← Back]     [WeWrite Logo]     [Action Buttons]
```

### 2. ContentPageHeader - Content Pages
**Purpose**: For individual pages, posts, articles with content
**File**: `app/components/pages/ContentPageHeader.tsx`

**Design Specifications**:
- **Collapsible/expandable** behavior
- **Edit mode**: Static header with editing controls
- **View mode**: Sticky header that can collapse on scroll
- **Contains**: Page title, author info, page actions
- **Logo placement**: In mobile view for home navigation

**Related Components** (kept separate):
- **StickySaveHeader**: Appears above ContentPageHeader when editing
- **PageFooter**: Contains bottom save actions

## Usage Guidelines

### When to Use NavHeader
- ✅ Timeline page (`/timeline`)
- ✅ Search page (`/search`)
- ✅ Settings pages (`/settings/*`)
- ✅ Notifications page (`/notifications`)
- ✅ Admin pages (`/admin/*`)
- ✅ Home page (`/`)
- ✅ Any navigation or utility page

### When to Use ContentPageHeader
- ✅ Individual ContentPages (`/[id]`)
- ✅ User profile pages (`/user/*`)
- ✅ Group pages (`/group/*`)
- ✅ New page creation (`/new`)
- ✅ Page editing interfaces
- ✅ Any page with user-generated content

## Component APIs

### NavHeader Props
```typescript
interface NavHeaderProps {
  backUrl?: string;           // URL for back navigation
  backLabel?: string;         // Text for back button (default: "Back")
  rightContent?: ReactNode;   // Action buttons for right side
  className?: string;         // Additional CSS classes
}
```

### ContentPageHeader Props
```typescript
interface ContentPageHeaderProps {
  title: string;
  username?: string;
  userId?: string;
  isEditing?: boolean;
  onTitleChange?: (title: string) => void;
  // ... other content-specific props
}
```

## Design Principles

### 1. Consistency
- All navigation pages use identical header structure
- WeWrite logo always in center for brand recognition
- Back button always on left with consistent styling

### 2. Clarity
- No icons in page titles - text only
- Clear visual hierarchy with proper spacing
- Consistent button styling and placement

### 3. Navigation
- WeWrite logo always navigates to home
- Back button provides clear exit path
- Right actions are contextual to each page

### 4. Responsive Design
- Mobile: Compact layout with icon-only buttons
- Desktop: Full text labels and expanded spacing
- Consistent behavior across breakpoints

## Migration Checklist

### For Each Navigation Page:
- [ ] Remove existing custom header implementation
- [ ] Import and use NavHeader component
- [ ] Remove icons from page titles
- [ ] Add WeWrite logo in center
- [ ] Move page-specific actions to rightContent prop
- [ ] Test back navigation functionality
- [ ] Verify responsive behavior

### Common Patterns:

#### Basic Navigation Page
```tsx
<NavHeader 
  backUrl="/"
  rightContent={
    <Button variant="outline" size="sm">
      Action
    </Button>
  }
/>
```

#### Settings Page
```tsx
<NavHeader 
  backUrl="/settings"
  rightContent={
    <div className="flex gap-2">
      <Button variant="outline" size="sm">Save</Button>
      <Button variant="ghost" size="sm">Reset</Button>
    </div>
  }
/>
```

## Implementation Status

### ✅ Completed
- [x] Header system analysis and documentation
- [x] NavHeader component redesigned with WeWrite logo center
- [x] Daily Notes Today button updated to calendar icon with dot
- [x] Timeline page converted to NavHeader
- [x] Search page converted to NavHeader
- [x] Notifications page converted to NavHeader
- [x] Settings pages converted to NavHeader
- [x] SettingsPageHeader component removed (duplicate)
- [x] All navigation headers standardized

### 🔄 In Progress
- [ ] Final testing and validation

### ⏳ Future Enhancements
- [ ] ContentPageHeader refinements (if needed)
- [ ] Additional responsive optimizations

## Recent Changes

### Daily Notes Today Button Update
- **Changed**: From text "Today" to calendar icon with dot indicator
- **Location**: Daily Notes section header (right side)
- **Functionality**: Maintains same scroll-to-today behavior
- **Visual**: Calendar icon with small primary-colored dot in top-right corner

## Notes

- This system replaces all existing navigation header implementations
- ContentPageHeader (PageHeader.tsx) remains largely unchanged (already well-designed)
- Focus on consistency and user experience
- WeWrite logo serves as both brand identifier and home navigation
- All duplicate header components have been removed
