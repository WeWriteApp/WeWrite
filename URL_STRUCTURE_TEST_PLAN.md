# URL Structure Test Plan

This document outlines the test plan for verifying the URL structure changes and fixing the page clicking error.

## 1. URL Structure Changes

### User URLs
- [ ] Verify that `/u/[id]` redirects to `/user/[id]`
- [ ] Verify that `/users/[id]` redirects to `/user/[id]`
- [ ] Verify that user profile pages load correctly at `/user/[id]`
- [ ] Verify that user links in components point to `/user/[id]`

### Group URLs
- [ ] Verify that `/g/[id]` redirects to `/group/[id]`
- [ ] Verify that `/groups/[id]` redirects to `/group/[id]`
- [ ] Verify that group pages load correctly at `/group/[id]`
- [ ] Verify that group links in components point to `/group/[id]`

### Page URLs
- [ ] Verify that `/pages/[id]` redirects to `/[id]`
- [ ] Verify that page links in components point to `/[id]`

## 2. Error Handling

### Page Loading
- [ ] Verify that clicking on a page loads without errors
- [ ] Verify that error handling in SinglePageView.js works correctly
- [ ] Verify that reading history tracking doesn't cause errors

### User Profile Loading
- [ ] Verify that user profiles load without errors
- [ ] Verify that error handling in user profile pages works correctly

### Group Loading
- [ ] Verify that group pages load without errors
- [ ] Verify that error handling in group pages works correctly

## 3. Component Testing

### PillLink Component
- [ ] Verify that PillLink correctly converts old URL formats to new ones
- [ ] Verify that PillLink renders correctly with the new URL structure

### SlateEditor Component
- [ ] Verify that user links in the editor use the new URL structure
- [ ] Verify that link detection and formatting work correctly

### ActivityItem Component
- [ ] Verify that activity items link to the correct URLs
- [ ] Verify that user links in activity items use the new URL structure

## 4. Edge Cases

### URL Parameters
- [ ] Verify that URLs with query parameters work correctly
- [ ] Verify that URLs with hash fragments work correctly

### Non-existent Resources
- [ ] Verify that non-existent user IDs show a proper error message
- [ ] Verify that non-existent group IDs show a proper error message
- [ ] Verify that non-existent page IDs show a proper error message

## 5. Performance

- [ ] Verify that redirects are fast and don't cause noticeable delays
- [ ] Verify that error handling doesn't impact performance

## Test Execution

For each test case:
1. Perform the test
2. Document any issues found
3. Fix issues and retest

## Rollback Plan

If critical issues are found:
1. Revert the URL structure changes
2. Keep the error handling improvements
3. Create a more detailed plan for URL structure changes
