# User Data Fetching Patterns

## Overview

This document establishes the standardized patterns for fetching user data (usernames, subscription info, etc.) across the WeWrite application to ensure consistency and prevent bugs.

## Core Principles

1. **All user data should be fetched using the standardized `/api/users/batch` endpoint on the client side.**
2. **🔒 CRITICAL SECURITY: Never expose email addresses as username fallbacks.** Use security utilities for all username displays.

## The Problem We Solved

Previously, different parts of the application had inconsistent user data fetching patterns:

- Some APIs (like trending) fetched user data server-side and included it in responses
- Some components fetched user data directly from Firebase
- Some used different data structures and field names
- This led to subscription badges being stuck in loading states and inconsistent user displays

## The Solution: Standardized Pattern

### 1. API Endpoints (Server-Side)

**APIs should focus on their core data and NOT fetch user information.**

```javascript
// ✅ CORRECT: Trending API returns only page data
{
  id: "page123",
  title: "Page Title",
  views: 100,
  userId: "user456",  // Include userId for client-side user data fetching
  // NO username, tier, subscriptionStatus, etc.
}

// ❌ INCORRECT: API fetching user data
{
  id: "page123", 
  title: "Page Title",
  views: 100,
  userId: "user456",
  username: "john_doe",  // Don't do this
  tier: "tier1"          // Don't do this
}
```

### 2. Client Components (React)

**Components should use the batch user API to fetch all user data at once.**

```typescript
import { sanitizeUsername } from '../../utils/usernameSecurity';

// ✅ CORRECT: Standard pattern for any component displaying user info
const [items, setItems] = useState([]);

useEffect(() => {
  const fetchData = async () => {
    // 1. Fetch core data from specific API
    const response = await fetch('/api/trending');
    const { trendingPages } = await response.json();

    // 2. Extract unique user IDs
    const userIds = [...new Set(trendingPages.map(page => page.userId).filter(Boolean))];

    // 3. Fetch user data using batch API
    if (userIds.length > 0) {
      const userData = await getBatchUserData(userIds);

      // 4. Merge user data with core data (with security sanitization)
      const itemsWithUserData = trendingPages.map(page => ({
        ...page,
        username: sanitizeUsername(userData[page.userId]?.username), // 🔒 SECURITY: Sanitize username
        tier: userData[page.userId]?.tier,
        subscriptionStatus: userData[page.userId]?.subscriptionStatus,
        subscriptionAmount: userData[page.userId]?.subscriptionAmount
      }));

      setItems(itemsWithUserData);
    } else {
      setItems(trendingPages);
    }
  };

  fetchData();
}, []);
```

### 3. Batch User Data API

The `/api/users/batch` endpoint is the single source of truth for user information:

```typescript
// Input: Array of user IDs
const userIds = ["user1", "user2", "user3"];

// Output: Object with user data
const userData = {
  "user1": {
    uid: "user1",
    username: "john_doe",
    displayName: "John Doe", 
    tier: "tier1",
    subscriptionStatus: "active",
    subscriptionAmount: 10,
    // ... other user fields
  },
  "user2": { /* ... */ }
};
```

## Implementation Checklist

When implementing user data display in any component:

- [ ] API endpoint returns only core data + `userId` field
- [ ] Component extracts unique user IDs from core data
- [ ] Component calls `getBatchUserData(userIds)`
- [ ] Component merges user data with core data
- [ ] Component handles loading states properly
- [ ] Subscription badges receive `tier`, `subscriptionStatus`, `subscriptionAmount`
- [ ] 🔒 **SECURITY**: All usernames are sanitized using `sanitizeUsername()`
- [ ] 🔒 **SECURITY**: No email addresses are used as username fallbacks
- [ ] 🔒 **SECURITY**: Loading states show "Loading..." not email addresses

## Benefits

1. **Consistency**: All user data comes from the same source with the same format
2. **Performance**: Batch fetching is more efficient than individual requests
3. **Maintainability**: Changes to user data structure only need to be made in one place
4. **Reliability**: Reduces bugs from inconsistent data handling
5. **Caching**: The batch API can implement caching strategies effectively

## Examples of Correct Implementation

### Trending Pages
- ✅ `/api/trending` returns page data only
- ✅ `TrendingPageClient` uses batch user API
- ✅ Subscription badges work correctly

### Activity Feed  
- ✅ `/api/activity` returns activity data only
- ✅ Components use batch user API for user info
- ✅ Consistent user display across all activities

### Recent Pages
- ✅ `/api/recent-pages` returns page data only  
- ✅ Components use batch user API
- ✅ User information displays consistently

## Migration Guide

If you find components with inconsistent user data fetching:

1. **Identify the pattern**: Check if the API is fetching user data server-side
2. **Remove server-side user fetching**: Update API to return only core data + userId
3. **Add client-side batch fetching**: Use the standard pattern above
4. **Test subscription badges**: Ensure they receive proper data and aren't stuck loading
5. **Update documentation**: Add the component to the "correct implementation" list

## Common Pitfalls

- **Forgetting to include username**: When merging batch user data, include `username` field
- **Type mismatches**: Ensure `tier` is always a string (use `String(effectiveTier)` if needed)
- **Loading states**: Handle cases where user data is still loading
- **Error handling**: Gracefully handle batch API failures
- **Empty user lists**: Handle cases where no user IDs are present

## Related Files

- `/app/api/users/batch/route.ts` - Batch user data API
- `/app/firebase/batchUserData.ts` - Client-side batch fetching utility
- `/app/components/ui/SubscriptionTierBadge.tsx` - Subscription badge component
- `/app/utils/subscriptionTiers.ts` - Subscription tier utilities
- `/app/utils/usernameSecurity.ts` - 🔒 Username security utilities
- `/docs/USERNAME_SECURITY_GUIDELINES.md` - 🔒 Complete security documentation
