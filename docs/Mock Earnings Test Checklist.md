# Mock Earnings System Test Checklist

## Pre-Test Setup
- [ ] Ensure you are logged in as an admin user
- [ ] Navigate to `/admin` page
- [ ] Scroll to "Testing Tools" section
- [ ] Verify "Mock Token Earnings" tool is visible

## Basic Functionality Tests

### 1. Mock Earnings Creation
- [ ] Enter token amount (e.g., 100)
- [ ] Click "Create Mock Earnings"
- [ ] Verify success message appears
- [ ] Check browser console for any errors

### 2. Earnings Display
- [ ] Navigate to `/settings/earnings`
- [ ] Verify mock earnings appear in the earnings list
- [ ] Check that earnings show correct token amount and USD value
- [ ] Verify earnings are marked as "available" status

### 3. Test Mode Alert
- [ ] Verify orange test mode alert bar appears at top of page
- [ ] Check alert shows correct mock earnings summary
- [ ] Verify alert includes token count and USD amount
- [ ] Test "Exit Test Mode" button functionality

### 4. Mock Data Identification
- [ ] In earnings list, verify mock allocations show:
  - [ ] "Mock System" as the source
  - [ ] "Mock Test Page" as the resource
  - [ ] Clear indication this is test data

### 5. Reset Functionality
- [ ] Click "Reset Mock Earnings" in admin panel
- [ ] Verify success message with cleanup details
- [ ] Navigate to `/settings/earnings`
- [ ] Confirm mock earnings are removed
- [ ] Verify test mode alert bar disappears

## Security Tests

### 6. Admin Access Control
- [ ] Log out and try accessing `/api/admin/mock-token-earnings` directly
- [ ] Verify 401 Unauthorized response
- [ ] Log in as non-admin user (if available)
- [ ] Verify 403 Forbidden response

### 7. Data Isolation
- [ ] Create mock earnings
- [ ] Verify mock data uses distinct identifiers:
  - [ ] `fromUserId: 'system_mock_allocator'`
  - [ ] `fromUsername: 'Mock System'`
  - [ ] `resourceId: 'mock_page_*'`

## Edge Cases

### 8. Multiple Mock Earnings
- [ ] Create mock earnings for current month
- [ ] Create additional mock earnings for same month
- [ ] Verify earnings are properly aggregated
- [ ] Check that both allocations appear in earnings list

### 9. Mixed Real and Mock Data
- [ ] If real earnings exist, create mock earnings
- [ ] Verify both real and mock earnings display correctly
- [ ] Confirm test mode alert appears despite real data
- [ ] Verify reset only removes mock data

### 10. Error Handling
- [ ] Try creating mock earnings with invalid data:
  - [ ] Empty token amount
  - [ ] Invalid month format
  - [ ] Negative token amount
- [ ] Verify appropriate error messages

## UI/UX Validation

### 11. Visual Indicators
- [ ] Test mode alert bar is prominent and noticeable
- [ ] Mock earnings are clearly distinguishable from real earnings
- [ ] Loading states work properly during creation/reset
- [ ] Success/error messages are clear and helpful

### 12. Responsive Design
- [ ] Test on mobile device or narrow browser window
- [ ] Verify test mode alert bar displays properly
- [ ] Check admin tools are accessible on mobile

## Performance Tests

### 13. Large Mock Data
- [ ] Create multiple mock earnings (5-10 entries)
- [ ] Verify page load performance remains good
- [ ] Test reset functionality with multiple entries
- [ ] Confirm all mock data is properly cleaned up

## Browser Compatibility

### 14. Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Verify consistent behavior across browsers

## Final Validation

### 15. Complete Workflow
- [ ] Start with clean state (no mock earnings)
- [ ] Create mock earnings
- [ ] Verify display and test mode alert
- [ ] Reset mock earnings
- [ ] Confirm return to clean state
- [ ] Check browser console for any errors throughout

### 16. Production Safety
- [ ] Verify mock data cannot be confused with real data
- [ ] Confirm reset functionality is safe and complete
- [ ] Check that admin tools are properly restricted
- [ ] Verify no sensitive data is logged to console

## Troubleshooting

### Common Issues and Solutions

**Mock earnings not appearing:**
- Check browser console for errors
- Verify admin user permissions
- Confirm API endpoints are responding correctly

**Test mode alert not showing:**
- Refresh the page
- Check TestModeDetectionService logs in console
- Verify mock data has correct identifiers

**Reset not working:**
- Check admin permissions
- Verify API response in network tab
- Confirm mock identifiers are correct

**Permission errors:**
- Verify user email is in admin list
- Check Firebase authentication status
- Confirm admin API endpoints are accessible

## Notes
- All tests should be performed in a development environment
- Document any issues or unexpected behavior
- Report security concerns immediately
- Keep test data minimal and clean up after testing
