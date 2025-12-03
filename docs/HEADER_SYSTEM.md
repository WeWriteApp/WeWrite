# WeWrite Header System Documentation

## Overview

WeWrite uses a three-header system to provide consistent navigation and user experience across the application, with different headers for different page types.

## Header Types

### 1. FloatingFinancialHeader - Navigation Pages Only
**Purpose**: Floating financial header for logged-in users on navigation pages
**File**: `app/components/layout/FloatingFinancialHeader.tsx`

**Design Specifications**:
- **Position**: Floating at top with translucency and blur
- **Left**: Spend/balance display with hover tooltips (desktop) or tap dropdowns (mobile)
- **Center**: WeWrite logo (clickable to home)
- **Right**: Earnings display with hover tooltips (desktop) or tap dropdowns (mobile)
- **Visibility**: Only shows on NavPages, automatically hidden on content pages
- **Responsive**: Respects sidebar positioning on desktop

**Layout Structure**:
```
[Spend/Balance]     [WeWrite Logo]     [Earnings]
```

**Visibility Logic**:
- ✅ Shows on navigation pages (/, /trending, /search, /settings, etc.)
- 🚫 Hidden on content pages (/[id]/ pages)
- 🚫 Hidden on settings and admin pages
- 🚫 Hidden when user is editing content (contenteditable detection)

### 2. ContentPageHeader - Content Pages Only
**Purpose**: For individual pages, posts, articles with content
**File**: `app/components/pages/ContentPageHeader.tsx`

**Design Specifications**:
- **Collapsible/expandable** behavior
- **Edit mode**: Static header with editing controls
- **View mode**: Sticky header that can collapse on scroll
- **Contains**: Page title, author info, page actions
- **Logo placement**: In mobile view for home navigation
- **Financial header**: FloatingFinancialHeader is automatically hidden on these pages

**Related Components** (kept separate):
- **StickySaveHeader**: Appears above ContentPageHeader when editing
- **ContentPageFooter**: Contains bottom save actions

### 3. SettingsHeader - Settings Pages
**Purpose**: For settings and administrative pages
**File**: `app/components/layout/SettingsHeader.tsx`

**Design Specifications**:
- **Purpose-built** for settings navigation
- **Contains**: Settings-specific navigation and controls
- **Financial header**: FloatingFinancialHeader is automatically hidden on these pages

## Usage Guidelines

### When FloatingFinancialHeader Shows (NavPages)
- ✅ Home page (`/`)
- ✅ Timeline page (`/timeline`)
- ✅ Search page (`/search`)
- ✅ Trending pages (`/trending`, `/trending-pages`)
- ✅ Activity page (`/activity`)
- ✅ Notifications page (`/notifications`)
- ✅ User pages (`/user/*`)
- ✅ Group pages (`/group/*`)
- ✅ Any navigation or utility page

### When FloatingFinancialHeader is Hidden
- 🚫 Individual content pages (`/[id]`) - use ContentPageHeader instead
- 🚫 Settings pages (`/settings/*`) - use SettingsHeader instead
- 🚫 Admin pages (`/admin/*`) - use SettingsHeader instead
- 🚫 When user is editing content (contenteditable detection)

### When to Use ContentPageHeader
- ✅ Individual ContentPages (`/[id]`)
- ✅ New page creation (`/new`)
- ✅ Page editing interfaces
- ✅ Any page with user-generated content

### When to Use SettingsHeader
- ✅ Settings pages (`/settings/*`)
- ✅ Admin pages (`/admin/*`)
- ✅ Any administrative interface

## Component APIs

### NavHeader Props
```typescript
interface NavHeaderProps {
  className?: string;         // Additional CSS classes
}
```

**Note**: NavHeader now automatically displays:
- **Left**: Spend/balance information (Add Funds button, remaining funds with pie chart, or overspend warning)
- **Center**: WeWrite logo (clickable to home)
- **Right**: Earnings information (total earnings with click to earnings page)

### ContentPageHeader Props
```typescript
interface ContentPageHeaderProps {
  title: string;
  username?: string;
  userId?: string;
  isEditing?: boolean; // Defaults to false (view mode) - enables collapsible behavior
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
- [x] Remove existing custom header implementation
- [x] Import and use NavHeader component
- [x] Remove back buttons and rightContent props
- [x] Move page-specific actions into page content
- [x] Add page headers with titles and descriptions
- [x] Verify financial information displays correctly

### Common Patterns:

#### Basic Navigation Page
```tsx
<NavPageLayout>
  {/* Page header with actions */}
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="text-2xl font-bold">Page Title</h1>
      <p className="text-muted-foreground">Page description</p>
    </div>
    <Button variant="outline" size="sm">
      Action
    </Button>
  </div>

  {/* Page content */}
  <div>...</div>
</NavPageLayout>
```

#### Settings Page
```tsx
<NavPageLayout maxWidth="4xl">
  {/* Page content with embedded actions */}
  <div>...</div>
</NavPageLayout>
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

### ContentPage Naming Convention Update (August 2025)
- **Changed**: All page-related components renamed to ContentPage convention
- **Components Renamed**:
  - `PageHeader` → `ContentPageHeader`
  - `PageView` → `ContentPageView`
  - `PageFooter` → `ContentPageFooter`
  - `PageActions` → `ContentPageActions`
  - `PageMenu` → `ContentPageMenu`
  - `PageStats` → `ContentPageStats`
  - `PageTabs` → `ContentPageTabs`
- **Purpose**: Clear distinction between ContentPages and NavPages
- **Collapsible Behavior Fixed**: ContentPageHeader now defaults to view mode (`isEditing = false`) enabling proper collapsible behavior for other people's content pages

### Daily Notes Today Button Update
- **Changed**: From text "Today" to calendar icon with dot indicator
- **Location**: Daily Notes section header (right side)
- **Functionality**: Maintains same scroll-to-today behavior
- **Visual**: Calendar icon with small primary-colored dot in top-right corner

## Notes

- This system replaces all existing navigation header implementations
- ContentPageHeader (formerly PageHeader.tsx) now uses proper ContentPage naming convention
- Collapsible header behavior restored for viewing other people's content pages
- Focus on consistency and user experience
- WeWrite logo serves as both brand identifier and home navigation
- All duplicate header components have been removed
- Clear distinction between ContentPages (individual content) and NavPages (navigation/utility pages)

## Related Documentation

- [Header Collapse Behavior](./HEADER_COLLAPSE_BEHAVIOR.md) - Collapse animations
- [Settings Navigation System](./SETTINGS_NAVIGATION_SYSTEM.md) - Settings UX patterns
- [Save Header System](./SAVE_HEADER_SYSTEM.md) - Save state in headers
- [Banner System Guide](./BANNER_SYSTEM_GUIDE.md) - Banner positioning
