# Duplicate Title Prevention System

## Overview

The duplicate title prevention system ensures that each user can only have one page per title. This helps keep content organized and allows other users to write pages with the same title, which will appear in "related pages."

## Architecture

### Components

1. **API Endpoint**: `/api/pages/check-duplicate` - Server-side duplicate checking
2. **Validation Utilities**: `utils/duplicateTitleValidation.ts` - Client-side validation functions
3. **Content Loss Prevention**: `utils/contentLossPreventionUtils.ts` - Prevents accidental content loss
4. **Modal Components**: 
   - `DuplicateTitleModal.tsx` - Shows duplicate error with navigation option
   - `ContentLossWarningModal.tsx` - Warns about unsaved content loss

### Integration Points

- **New Page Creation**: `app/new/page.tsx`
- **Page Editing**: `app/components/pages/PageView.tsx`
- **Server-side Prevention**: `app/api/pages/route.ts` (POST and PUT endpoints)

## User Experience Flow

### New Page Creation

1. User types title in new page form
2. System debounces and checks for duplicates in real-time
3. If duplicate found during save:
   - Show `DuplicateTitleModal` with "Go to [title]" option
   - If user has unsaved content, show `ContentLossWarningModal` first
   - User can choose to navigate away or change title

### Page Editing

1. User changes title of existing page
2. System checks for duplicates (excluding current page)
3. Same modal flow as new page creation
4. Original title is preserved for comparison

### Content Loss Prevention

1. System detects if user has meaningful content (text, links, etc.)
2. If navigating to duplicate page with unsaved content:
   - Show warning about losing content
   - Recommend changing title to save content first
   - Allow user to proceed anyway or stay and rename

## API Endpoints

### GET /api/pages/check-duplicate

**Parameters:**
- `title` (required): Title to check for duplicates
- `excludePageId` (optional): Page ID to exclude from check (for editing)

**Response:**
```json
{
  "success": true,
  "data": {
    "isDuplicate": false,
    "existingPage": null
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "You already have a page titled \"Example Title\"",
  "data": {
    "isDuplicate": true,
    "existingPage": {
      "id": "page123",
      "title": "Example Title",
      "lastModified": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

## Server-side Prevention

Both page creation (POST) and editing (PUT) endpoints include duplicate checking:

### Page Creation (POST /api/pages)
- Checks for existing pages with same title by same user
- Returns 400 error with duplicate information if found

### Page Editing (PUT /api/pages)
- Only checks if title is actually changing
- Excludes current page from duplicate check
- Returns 400 error with duplicate information if found

## Error Handling

### Client-side Errors
- Network failures: Gracefully degrade, don't block user
- API timeouts: Show generic error, allow retry
- Malformed responses: Log error, continue with fallback

### Server-side Errors
- Authentication failures: Return 401 with clear message
- Missing parameters: Return 400 with specific field errors
- Database errors: Return 500 with generic user message

### User-friendly Messages
- "You already have a page titled '[title]'"
- "Please enter a title"
- "Failed to check for duplicate title. Please try again."

## Content Detection

The system detects meaningful content to prevent accidental loss:

### Detected as Content:
- Non-empty text
- Page links (pill links)
- External links
- Any meaningful editor nodes

### Not Detected as Content:
- Empty paragraphs
- Whitespace-only text
- Invalid/broken links

## Testing

### Unit Tests
- Validation function behavior
- Content detection accuracy
- Error handling scenarios

### Integration Tests
- API endpoint responses
- Authentication flows
- Database interactions

### User Experience Tests
- Modal interactions
- Navigation flows
- Content preservation

## Configuration

### Environment Variables
- Uses standard WeWrite environment configuration
- Collection names determined by `getCollectionName()`
- Authentication handled by existing auth system

### Feature Flags
- No feature flags required
- Always-on functionality for data integrity

## Monitoring

### Logging
- Duplicate detection attempts
- User navigation choices
- Error occurrences
- Performance metrics

### Metrics to Track
- Duplicate title collision rate
- User behavior when duplicates found
- Content loss prevention effectiveness
- API response times

## Troubleshooting

### Common Issues

1. **False Positives**: Check for case sensitivity or whitespace issues
2. **Performance**: Monitor API response times, consider caching
3. **User Confusion**: Ensure error messages are clear and actionable

### Debug Information
- Enable console logging with `🔍` prefix for duplicate checking
- Check network tab for API request/response details
- Verify authentication state in browser dev tools

## Future Enhancements

### Potential Improvements
1. **Fuzzy Matching**: Detect similar titles (e.g., "My Page" vs "My Page!")
2. **Bulk Operations**: Handle multiple page operations efficiently
3. **Offline Support**: Cache duplicate checks for offline editing
4. **Analytics**: Track user behavior patterns around duplicates

### Performance Optimizations
1. **Caching**: Cache recent duplicate checks
2. **Debouncing**: Optimize real-time checking frequency
3. **Indexing**: Ensure database indexes support efficient queries
