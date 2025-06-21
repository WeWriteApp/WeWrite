# Link Notification Message Format Fix

## Problem
The notification message format for page linking notifications was displaying backwards:

**Incorrect (before fix):**
```
"[Other User] linked to your page [Their Page] from [My Page]"
```

**Correct (after fix):**
```
"[Other User] linked to your page [My Page] from [Their Page]"
```

## Root Cause
The issue was in `app/firebase/database/versions.ts` where the `createLinkNotification` function was being called with swapped parameters for the source and target page information.

## Fix Applied
Fixed the parameter order in the `createLinkNotification` call in `app/firebase/database/versions.ts` (lines 342-349):

### Before (incorrect):
```javascript
await createLinkNotification(
  targetPageData.userId,     // ✅ Correct: Target user
  data.userId,               // ✅ Correct: Source user  
  pageId,                    // ❌ WRONG: Source page ID (should be target)
  sourcePageTitle,           // ❌ WRONG: Source page title (should be target)
  targetPageId,              // ❌ WRONG: Target page ID (should be source)
  targetPageData.title       // ❌ WRONG: Target page title (should be source)
);
```

### After (correct):
```javascript
await createLinkNotification(
  targetPageData.userId,                    // ✅ Target user (notification recipient)
  data.userId,                              // ✅ Source user (link creator)
  targetPageId,                             // ✅ Target page ID (page being linked TO)
  targetPageData.title || "Untitled Page", // ✅ Target page title (page being linked TO)
  pageId,                                   // ✅ Source page ID (page containing the link)
  sourcePageTitle                           // ✅ Source page title (page containing the link)
);
```

## Function Signature Reference
The `createLinkNotification` function expects parameters in this order:
1. `targetUserId` - User who owns the page being linked TO (notification recipient)
2. `sourceUserId` - User who created the link
3. `targetPageId` - Page being linked TO
4. `targetPageTitle` - Title of page being linked TO ("your page")
5. `sourcePageId` - Page containing the link (linking FROM)
6. `sourcePageTitle` - Title of page containing the link ("from" page)

## Verification
- ✅ Created test file `app/test/linkNotificationTest.js` to verify the fix
- ✅ Test confirms correct message format: "linked to your page [Target Page] from [Source Page]"
- ✅ Notification display logic in `app/components/utils/NotificationItem.js` is correct
- ✅ Backfill script in `app/scripts/backfillNotifications.js` was already correct

## Testing the Fix
To test that notifications now show the correct format:

1. **Create a test scenario:**
   - User A creates a link on their page that points to User B's page
   - User B should receive a notification

2. **Expected notification message:**
   ```
   "User A linked to your page [User B's Page] from [User A's Page]"
   ```

3. **Run the test:**
   ```bash
   node -e "const { testLinkNotificationFormat } = require('./app/test/linkNotificationTest.js'); testLinkNotificationFormat();"
   ```

## Files Modified
- `app/firebase/database/versions.ts` - Fixed parameter order in createLinkNotification call
- `app/test/linkNotificationTest.js` - Added test to verify the fix

## Impact
- ✅ New link notifications will display the correct message format
- ✅ Users will clearly understand which page was linked to and from which page
- ✅ No impact on existing notifications (they remain as-is)
- ✅ No breaking changes to the notification system

## Related Files (verified as correct)
- `app/firebase/notifications.ts` - Function signature and implementation correct
- `app/components/utils/NotificationItem.js` - Display logic correct
- `app/scripts/backfillNotifications.js` - Backfill logic already correct
