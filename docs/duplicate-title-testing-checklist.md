# Duplicate Title Prevention - Manual Testing Checklist

## Pre-Testing Setup

- [ ] Ensure you have a test account with some existing pages
- [ ] Note down titles of existing pages for testing
- [ ] Open browser dev tools to monitor console logs and network requests
- [ ] Clear browser cache if needed

## New Page Creation Tests

### Basic Duplicate Detection
- [ ] Navigate to `/new`
- [ ] Enter title of an existing page you own
- [ ] Try to save the page
- [ ] **Expected**: Duplicate modal should appear with "Go to [title]" button

### Content Loss Prevention - No Content
- [ ] Create new page with duplicate title (no body content)
- [ ] Click "Go to [title]" in duplicate modal
- [ ] **Expected**: Should navigate directly to existing page

### Content Loss Prevention - With Content
- [ ] Create new page with duplicate title
- [ ] Add some text content in the body
- [ ] Try to save
- [ ] Click "Go to [title]" in duplicate modal
- [ ] **Expected**: Content warning modal should appear
- [ ] Click "Go Anyway (Lose Content)"
- [ ] **Expected**: Should navigate to existing page, content lost

### Content Loss Prevention - Stay and Rename
- [ ] Create new page with duplicate title and content
- [ ] Try to save, get duplicate modal
- [ ] Click "Go to [title]", get content warning modal
- [ ] Click "Stay & Rename Title (Recommended)"
- [ ] **Expected**: Should close modals, stay on new page
- [ ] Change title to something unique and save
- [ ] **Expected**: Page should save successfully

### Unique Title Success
- [ ] Create new page with unique title
- [ ] Add some content
- [ ] Save the page
- [ ] **Expected**: Should save successfully and navigate to new page

## Page Editing Tests

### Edit Without Changing Title
- [ ] Open an existing page you own
- [ ] Edit the content (don't change title)
- [ ] Save the page
- [ ] **Expected**: Should save successfully

### Edit Title to Duplicate
- [ ] Open an existing page you own
- [ ] Change title to match another page you own
- [ ] Try to save
- [ ] **Expected**: Duplicate modal should appear

### Edit Title to Unique
- [ ] Open an existing page you own
- [ ] Change title to something unique
- [ ] Save the page
- [ ] **Expected**: Should save successfully

### Edit Title Back to Original
- [ ] Open an existing page you own
- [ ] Change title to something else, then back to original
- [ ] Save the page
- [ ] **Expected**: Should save successfully (no duplicate error)

## API Endpoint Tests

### Direct API Testing
- [ ] Open browser dev tools, go to Console tab
- [ ] Test unique title:
  ```javascript
  fetch('/api/pages/check-duplicate?title=Unique Test Title 123', {credentials: 'include'})
    .then(r => r.json()).then(console.log)
  ```
- [ ] **Expected**: `{success: true, data: {isDuplicate: false, existingPage: null}}`

- [ ] Test duplicate title (replace with actual title you own):
  ```javascript
  fetch('/api/pages/check-duplicate?title=Your Existing Title', {credentials: 'include'})
    .then(r => r.json()).then(console.log)
  ```
- [ ] **Expected**: `{success: false, error: "You already have...", data: {isDuplicate: true, existingPage: {...}}}`

### Authentication Tests
- [ ] Log out of your account
- [ ] Try the API call above
- [ ] **Expected**: Should return 401 Unauthorized

### Error Handling Tests
- [ ] Test missing title parameter:
  ```javascript
  fetch('/api/pages/check-duplicate', {credentials: 'include'})
    .then(r => r.json()).then(console.log)
  ```
- [ ] **Expected**: Should return 400 Bad Request

## Related Pages Verification

### Same Title from Other Users
- [ ] Create a page with title "Test Topic"
- [ ] Have another user (or test account) create page with same title "Test Topic"
- [ ] View your page
- [ ] Scroll to "Others' Related Pages" section
- [ ] **Expected**: Should see the other user's page with same title

### Different Users, Different Titles
- [ ] Verify that pages with different titles but similar content appear in related pages
- [ ] **Expected**: Related pages should work as before

## Error Scenarios

### Network Issues
- [ ] Open dev tools, go to Network tab
- [ ] Set network to "Slow 3G" or "Offline"
- [ ] Try to create page with duplicate title
- [ ] **Expected**: Should handle gracefully, show appropriate error message

### Server Errors
- [ ] This requires backend testing or mocking server errors
- [ ] **Expected**: Should show user-friendly error messages, not expose technical details

## User Experience Validation

### Modal Behavior
- [ ] Verify duplicate modal can be closed with X button
- [ ] Verify content warning modal can be closed with X button
- [ ] Verify modals are accessible (can be navigated with keyboard)
- [ ] Verify modals appear above other content (z-index)

### Error Messages
- [ ] Verify all error messages are user-friendly
- [ ] Verify error messages provide actionable guidance
- [ ] Verify error messages include the specific title that caused the conflict

### Performance
- [ ] Check that duplicate checking doesn't cause noticeable delays
- [ ] Verify debouncing works (not too many API calls while typing)
- [ ] Check console for any performance warnings

## Edge Cases

### Special Characters in Titles
- [ ] Test titles with emojis: "My Page 🚀"
- [ ] Test titles with special characters: "My Page & More!"
- [ ] Test titles with quotes: 'My "Special" Page'
- [ ] **Expected**: Should handle all characters correctly

### Very Long Titles
- [ ] Test with very long title (200+ characters)
- [ ] **Expected**: Should handle gracefully

### Whitespace Handling
- [ ] Test title with leading/trailing spaces: "  My Page  "
- [ ] Test title with only spaces: "    "
- [ ] **Expected**: Should trim whitespace and handle empty titles

### Case Sensitivity
- [ ] Create page with title "Test Page"
- [ ] Try to create another with "test page" or "TEST PAGE"
- [ ] **Expected**: Should detect as duplicate (case-insensitive)

## Cleanup

- [ ] Delete any test pages created during testing
- [ ] Clear browser cache if needed
- [ ] Document any issues found during testing

## Issues to Report

For each issue found, document:
- [ ] Steps to reproduce
- [ ] Expected behavior
- [ ] Actual behavior
- [ ] Browser and version
- [ ] Console errors (if any)
- [ ] Network requests (if relevant)

## Success Criteria

All tests should pass with:
- ✅ Duplicate titles are properly detected and prevented
- ✅ Content loss prevention works correctly
- ✅ User experience is smooth and intuitive
- ✅ Error messages are clear and helpful
- ✅ Related pages still show same-title pages from other users
- ✅ No console errors or warnings
- ✅ Good performance (no noticeable delays)
