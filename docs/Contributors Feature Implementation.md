# Contributors Count Feature Implementation

## Overview

This document describes the implementation of the Contributors count display for user profiles, which shows the number of active paying supporters for each user.

## Feature Requirements Met

✅ **Feature Flag Gating**: Only displays when "payments" feature flag is enabled  
✅ **Contributors Count Logic**: Counts unique users with active/completed pledges  
✅ **Display Requirements**: Shows prominently on user profile pages with consistent styling  
✅ **Real-time Updates**: Uses real-time listeners for immediate updates  
✅ **Performance Considerations**: Implements caching and efficient queries  
✅ **Error Handling**: Proper error handling and loading states  

## Implementation Details

### Files Created/Modified

1. **`app/firebase/counters.ts`**
   - Added `getUserContributorCount()` function
   - Added `updateUserContributorCount()` function
   - Follows same caching pattern as other counter functions

2. **`app/services/ContributorsService.ts`** (NEW)
   - Real-time contributor count service
   - Handles pledge change subscriptions
   - Provides both one-time and real-time data fetching

3. **`app/hooks/useContributorCount.ts`** (NEW)
   - React hook for contributor count management
   - Supports both static and real-time modes
   - Includes loading states and error handling

4. **`app/firebase/pledgeEvents.ts`** (NEW)
   - Event handlers for pledge changes
   - Automatically updates contributor counts when pledges change
   - Handles creation, status changes, and deletion

5. **`app/components/pages/SingleProfileView.js`**
   - Added contributor count display to user stats section
   - Integrated with payments feature flag
   - Uses real-time hook for live updates

### Data Flow

```
Pledges Collection (Firestore)
    ↓
ContributorsService (Real-time listener)
    ↓
useContributorCount Hook
    ↓
SingleProfileView Component
    ↓
User Profile Display
```

### Contributors Count Logic

The contributor count is calculated by:

1. Querying the `pledges` collection for pledges where `metadata.authorUserId` equals the profile user ID
2. Filtering for pledges with status `'active'` or `'completed'`
3. Counting unique `userId` values (pledge creators)
4. Caching the result in Firestore counters collection

### Feature Flag Integration

```javascript
const paymentsEnabled = useFeatureFlag('payments', user?.email);

// Only show contributor count when payments feature is enabled
{paymentsEnabled && (
  <div className="flex flex-col items-center gap-2">
    <span className="text-lg font-semibold">{contributorCount}</span>
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <DollarSign className="h-3 w-3" />
      <span>contributors</span>
    </div>
  </div>
)}
```

### Real-time Updates

The implementation uses Firestore real-time listeners to ensure contributor counts update immediately when:
- New pledges are created
- Pledge statuses change (active ↔ cancelled/failed)
- Pledges are deleted
- Users create/cancel subscriptions

### Performance Optimizations

1. **Caching**: Uses same caching strategy as other counters (localStorage + memory cache)
2. **Counter Documents**: Stores calculated counts in Firestore for fast retrieval
3. **Efficient Queries**: Uses compound indexes for fast pledge filtering
4. **Conditional Loading**: Only loads contributor data when payments feature is enabled

### Error Handling

- Graceful fallback to 0 contributors if queries fail
- Loading states during data fetching
- Error logging for debugging
- Silent error handling to prevent UI disruption

## Testing

To test the implementation:

1. **Enable Payments Feature Flag**:
   - Go to Admin → Feature Flags
   - Enable "payments" feature flag

2. **Create Test Pledges**:
   - Create pledges from different users to the same page author
   - Verify contributor count increases

3. **Test Real-time Updates**:
   - Change pledge statuses
   - Cancel/reactivate pledges
   - Verify counts update immediately

4. **Test Feature Flag Gating**:
   - Disable payments feature flag
   - Verify contributor count disappears from profile

## Database Schema

### Pledges Collection
```javascript
{
  id: string,
  userId: string,           // Pledger
  pageId: string,
  amount: number,
  status: 'active' | 'completed' | 'cancelled' | 'failed' | 'pending',
  metadata: {
    authorUserId: string,   // Page author (recipient)
    authorUsername: string,
    pageTitle: string
  }
}
```

### Counters Collection
```javascript
{
  id: `user_${userId}`,
  contributorCount: number,
  lastUpdated: Date
}
```

## Future Enhancements

1. **Contributor Details**: Show contributor usernames/avatars
2. **Contribution Amounts**: Display total contribution amounts
3. **Time-based Filtering**: Show contributors for specific time periods
4. **Contributor Badges**: Special badges for top contributors
5. **Analytics**: Track contributor growth over time
