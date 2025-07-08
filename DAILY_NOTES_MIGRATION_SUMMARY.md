# Daily Notes Migration to Multiple Notes Per Day

## Overview

Successfully implemented the migration from single daily notes (YYYY-MM-DD titles) to multiple daily notes per day using a `customDate` field. This allows users to have multiple notes for each day while maintaining the timeline carousel functionality.

## ✅ Completed Tasks

### 1. Database Schema Updates
- ✅ Added `customDate` field to Page interface in `app/types/database.ts`
- ✅ Updated `CreatePageData` interface in `app/firebase/database/core.ts`
- ✅ Updated API route interfaces in `app/api/pages/route.ts`

### 2. Migration Script
- ✅ Created comprehensive migration script: `scripts/migrate-daily-notes.js`
- ✅ Features:
  - Dry run mode for safe testing
  - Batch processing to avoid overwhelming Firestore
  - Detailed logging and progress tracking
  - Idempotent (safe to run multiple times)
  - Validates date formats and skips invalid dates
- ✅ Updated documentation in `scripts/README.md`

### 3. Page Creation Logic Updates
- ✅ Modified `app/new/page.tsx` to create daily notes with:
  - Title: "Daily note" (instead of YYYY-MM-DD)
  - `customDate` field: YYYY-MM-DD value
- ✅ Updated UI to show "Daily note" as title while preserving date functionality
- ✅ Locked title editing for daily notes to maintain consistency

### 4. Custom Date Field UI
- ✅ Enhanced `PageStats` component with custom date display
- ✅ Added clickable calendar picker for page owners
- ✅ Created API endpoint: `/api/pages/[id]/custom-date/route.js`
- ✅ Integrated with page footer to show custom dates

### 5. Daily Notes Carousel Enhancement
- ✅ Updated carousel to support multiple notes per day
- ✅ Modified data structures to handle arrays of notes per date
- ✅ Enhanced `DayCard` component with note count indicators
- ✅ Updated click handling for multiple notes (navigates to first note)
- ✅ Backward compatibility with legacy YYYY-MM-DD title format

### 6. Database Query Optimization
- ✅ Updated `app/utils/dailyNoteNavigation.ts` functions:
  - `findPreviousExistingDailyNote()` - now checks customDate first
  - `findNextExistingDailyNote()` - now checks customDate first  
  - `checkDailyNoteExists()` - supports both formats
  - `getDailyNotePageId()` - supports both formats
- ✅ Maintains backward compatibility with legacy title-based notes

## 🚀 Migration Instructions

### Step 1: Backup Database
```bash
# Ensure you have a recent backup of your Firestore database
```

### Step 2: Run Migration Script (Dry Run)
```bash
# Test the migration without making changes
node scripts/migrate-daily-notes.js --dry-run
```

### Step 3: Run Migration Script (Live)
```bash
# Perform the actual migration
node scripts/migrate-daily-notes.js
```

### Step 4: Create Firestore Index (Optional but Recommended)
For better performance, create a composite index on:
- Collection: `pages`
- Fields: `userId` (Ascending), `customDate` (Ascending), `deleted` (Ascending)

### Step 5: Deploy Application
Deploy the updated application code to your environment.

## 🎯 Key Features

### Multiple Notes Per Day
- Users can now create multiple notes for the same date
- Each note has title "Daily note" with a `customDate` field
- Carousel shows count indicators for days with multiple notes

### Custom Date Picker
- Page owners can change the custom date for any page
- Accessible through the page stats section
- Clean modal interface with date validation

### Backward Compatibility
- Existing YYYY-MM-DD titled notes continue to work
- Migration script converts them to the new format
- All queries support both old and new formats during transition

### Enhanced UI
- Day cards show note counts for multiple notes
- Improved visual indicators (checkmarks vs. count badges)
- Smooth navigation between notes

## 🔧 Technical Details

### Data Structure Changes
```typescript
// Before
interface Page {
  title: string; // "2024-01-15"
  // ...
}

// After  
interface Page {
  title: string; // "Daily note"
  customDate?: string; // "2024-01-15"
  // ...
}
```

### API Endpoints
- `GET /api/pages/[id]/custom-date` - Get custom date for a page
- `PATCH /api/pages/[id]/custom-date` - Update custom date for a page

### Migration Script Features
- Validates YYYY-MM-DD format dates
- Skips already migrated pages (idempotent)
- Configurable batch sizes
- Comprehensive error handling and logging
- Dry run mode for safe testing

## 🧪 Testing

### Test Migration Script
```bash
# Test with dry run
node scripts/migrate-daily-notes.js --dry-run --batch-size=10

# Test with small batch
node scripts/migrate-daily-notes.js --batch-size=5
```

### Test Daily Notes Functionality
1. Create a new daily note from the carousel
2. Verify it has title "Daily note" and correct customDate
3. Create multiple notes for the same day
4. Verify carousel shows count indicator
5. Test custom date picker functionality
6. Test navigation between multiple notes

## 📋 Next Steps

1. **Run Migration**: Execute the migration script on your production database
2. **Monitor Performance**: Watch for any query performance issues
3. **Create Indexes**: Add recommended Firestore indexes for optimal performance
4. **User Communication**: Inform users about the new multiple notes per day feature
5. **Future Enhancement**: Consider adding a note selection modal for days with many notes

## 🔍 Troubleshooting

### Migration Issues
- Check Firebase service account permissions
- Verify `firebase-service-account.json` exists
- Review migration script logs for specific errors

### Performance Issues
- Create recommended Firestore indexes
- Monitor query performance in Firebase console
- Consider reducing batch sizes if timeouts occur

### UI Issues
- Clear browser cache after deployment
- Verify custom date field appears in page stats
- Test calendar picker functionality

## 📚 Files Modified

### Core Files
- `app/types/database.ts` - Added customDate field
- `app/new/page.tsx` - Updated page creation logic
- `app/components/pages/PageStats.js` - Added custom date UI
- `app/components/daily-notes/DayCard.tsx` - Added count indicators
- `app/components/daily-notes/DailyNotesCarousel.tsx` - Multiple notes support
- `app/utils/dailyNoteNavigation.ts` - Updated queries

### New Files
- `scripts/migrate-daily-notes.js` - Migration script
- `app/api/pages/[id]/custom-date/route.js` - Custom date API

### Documentation
- `scripts/README.md` - Updated with migration instructions
- `DAILY_NOTES_MIGRATION_SUMMARY.md` - This summary document
