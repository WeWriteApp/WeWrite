# Duplicate Title Error Message Fix

## Problem
When trying to create a page with a duplicate title, users were seeing a generic error message:
```
Error: API request failed: 400 Bad Request
```

Instead of the descriptive error message that the API was actually returning:
```
You already have a page titled "Page Title"
```

## Root Cause
The issue was in the client-side error parsing logic. The API was correctly returning descriptive error messages in the `error` field of the response, but the client code was only checking for `errorData.message` instead of `errorData.error`.

### API Response Structure
Our API uses this standardized response format:
```json
{
  "success": false,
  "timestamp": "2025-08-15T15:00:35.049Z",
  "data": {
    "isDuplicate": true,
    "existingPage": {
      "id": "pageId",
      "title": "Page Title",
      "lastModified": "2025-08-15T15:00:30.150Z",
      "createdAt": "2025-08-15T15:00:30.150Z"
    }
  },
  "error": "You already have a page titled \"Page Title\""
}
```

The error message is in the `error` field, not the `message` field.

## Files Fixed

### 1. `/app/new/page.tsx` (Page Creation)
**Location**: Lines 783-788 in `attemptPageCreation` function

**Before**:
```javascript
if (errorData.message) {
  errorMessage = errorData.message;
}
```

**After**:
```javascript
// Check for error message in the correct field - API uses 'error' field, not 'message'
if (errorData.error) {
  errorMessage = errorData.error;
} else if (errorData.message) {
  errorMessage = errorData.message;
}
```

### 2. `/app/components/pages/PageView.tsx` (Page Editing)
**Location 1**: Lines 932-938 in page creation from link functionality

**Before**:
```javascript
if (errorData.message) {
  errorMessage = errorData.message;
}
```

**After**:
```javascript
// Check for error message in the correct field - API uses 'error' field, not 'message'
if (errorData.error) {
  errorMessage = errorData.error;
} else if (errorData.message) {
  errorMessage = errorData.message;
}
```

**Location 2**: Line 1171 in page save error handling

**Before**:
```javascript
const errorMessage = errorData.message || `API request failed: ${response.status} ${response.statusText}`;
```

**After**:
```javascript
// Check for error message in the correct field - API uses 'error' field, not 'message'
const errorMessage = errorData.error || errorData.message || `API request failed: ${response.status} ${response.statusText}`;
```

## Testing
Created comprehensive test suite in `/app/tests/duplicate-title-error-message.test.js` that verifies:

1. ✅ Error messages are correctly extracted from the `error` field
2. ✅ Fallback to `message` field works if `error` field is not present
3. ✅ Graceful fallback to generic error when JSON parsing fails
4. ✅ Proper handling of empty response bodies
5. ✅ API response format validation

All tests pass successfully.

## API Verification
Tested the actual API endpoints:

1. ✅ Creating a page with unique title: Returns success
2. ✅ Creating a page with duplicate title: Returns descriptive error message in `error` field
3. ✅ Error message format: `"You already have a page titled \"Title\""`

## Impact
- ✅ Users now see descriptive error messages when trying to create duplicate pages
- ✅ Error messages clearly explain what went wrong and what the user needs to do
- ✅ Consistent error handling across page creation and editing flows
- ✅ Backward compatibility maintained (still checks `message` field as fallback)

## Future Considerations
- All other parts of the codebase already correctly handle the `error` field first
- The `apiClient.ts` utility correctly prioritizes `data.error` over other fields
- Most error handling throughout the app follows the correct pattern

This fix ensures that users get clear, actionable error messages when attempting to create pages with duplicate titles, improving the overall user experience.
