# Activity Card Diff Standardization

## Overview

This document outlines the standardization of diff display across all ActivityCard implementations in the WeWrite application. All activity cards now use a consistent, enhanced diff algorithm that meets the established requirements.

## Requirements Met

✅ **Green background for text additions**
✅ **Red background with strikethrough for text deletions**  
✅ **Display up to 3 lines of context around changes**
✅ **Show both added and deleted text simultaneously in previews**
✅ **All diff logic consolidated into a single utility file**

## Implementation

### New Components Created

#### 1. `app/components/DiffPreview.js`
- **DiffPreview Component**: Reusable component for displaying diff previews with consistent styling
- **DiffStats Component**: Reusable component for displaying diff statistics (added/removed counts)
- Both components ensure standardized styling across all activity card implementations

### Updated Components

#### 1. `app/components/ActivityCard.js` (Main Activity Card)
- Updated to use the new `DiffPreview` and `DiffStats` components
- Maintains all existing functionality while ensuring consistency
- Used in:
  - `/activity` page
  - Home page activity section
  - Landing page carousels
  - Page history views

#### 2. `app/components/ActivityItem.js` (Alternative Activity Card)
- Updated to use the new `DiffPreview` and `DiffStats` components
- Cleaned up unused imports
- Maintains compact layout for specific use cases

### Existing Utilities (Already Compliant)

#### 1. `app/utils/generateTextDiff.js`
- Contains the enhanced diff algorithm with `generateEnhancedDiffPreview()` function
- Provides up to 3 lines of context (120 characters ≈ 3 lines)
- Accurately calculates character-level diffs using Longest Common Subsequence (LCS)
- Returns structured diff data with `beforeContext`, `addedText`, `removedText`, `afterContext`

#### 2. `app/components/diff-styles.css`
- Contains CSS classes for diff highlighting (though not currently used in favor of Tailwind classes)
- Available for future use if needed

## Styling Standards

### Addition Styling
```css
background: bg-green-50 dark:bg-green-900/40
color: text-green-600 dark:text-green-400
padding: px-0.5
border-radius: rounded
```

### Deletion Styling
```css
background: bg-red-50 dark:bg-red-900/40
color: text-red-600 dark:text-red-400
text-decoration: line-through
padding: px-0.5
border-radius: rounded
```

### Context Styling
```css
color: text-muted-foreground dark:text-slate-300
```

## Activity Card Locations Verified

All the following locations now use the standardized diff implementation:

1. **Main Activity Page** (`/activity`)
   - Uses `ActivityPageClient.tsx` → `ActivityCard.js`

2. **User Profile Pages** (`/user/[id]`)
   - Uses `UserProfileTabs.js` → `RecentActivity.js` → `ActivityCard.js`

3. **Home Page Activity Section**
   - Uses `ActivitySection.js` → `RecentActivity.js` → `ActivityCard.js`

4. **Landing Page Carousels**
   - `ActivityCarousel.tsx` → `ActivityCard.js`
   - `SimpleActivityCarousel.tsx` → `ActivityCard.js`
   - `ActivityCarouselClient.tsx` → `ActivityCard.js`

5. **Page History Views** (`/[id]/history`)
   - Uses `history/page.js` → `ActivityCard.js`

## Benefits of Standardization

1. **Consistency**: All activity cards now display diffs identically
2. **Maintainability**: Single source of truth for diff display logic
3. **Reusability**: Components can be easily reused in new contexts
4. **Accessibility**: Consistent color coding and styling across the app
5. **Performance**: Optimized diff algorithm with proper context handling

## Testing

- ✅ Development server starts without errors
- ✅ No TypeScript/ESLint compilation errors
- ✅ All imports resolved correctly
- ✅ Components properly exported and imported

## Future Considerations

1. **CSS Classes**: The existing `diff-styles.css` could be integrated if moving away from Tailwind
2. **Accessibility**: Consider adding ARIA labels for screen readers
3. **Performance**: Monitor performance with large diffs and optimize if needed
4. **Customization**: The components are designed to be easily customizable for different contexts

## Conclusion

All ActivityCard implementations across the WeWrite application now use the standardized diff display algorithm. The implementation meets all specified requirements and provides a consistent user experience across all activity views.
