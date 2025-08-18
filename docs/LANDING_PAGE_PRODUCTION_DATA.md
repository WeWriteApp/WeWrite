# Logged-Out User Production Data System

## Overview

WeWrite has a special requirement: **ALL logged-out users must ALWAYS see production data**, regardless of the development environment. This ensures that potential users see an accurate representation of the platform with real content, whether they're on the landing page, auth pages, or any other logged-out experience.

This applies to:
- **Landing page** - Shows real trending content and activity
- **Auth pages** - Any content displayed during login/signup flows
- **Any logged-out user interactions** - Read-only operations use production data

Only after successful authentication do users switch to environment-appropriate collections (DEV_ collections in development).

## Architecture

### The Problem

In development environments, WeWrite uses prefixed collections (e.g., `DEV_pages`, `DEV_users`) to isolate development data from production data. However, the landing page needs to show real production content to give potential users an authentic experience.

### The Solution: Request Header Override

We implemented a **request header-based system** that allows ANY logged-out user to automatically use production collections for read-only operations without affecting authenticated users or write operations.

## How It Works

### 1. Production Data Fetch Hook

**File**: `app/hooks/useProductionDataFetch.ts`

This hook provides a custom fetch function that automatically adds the `X-Force-Production-Data: true` header for ALL logged-out users throughout the app:

```typescript
const fetchJson = useProductionDataFetchJson();
const data = await fetchJson('/api/trending?limit=20');
// Automatically adds X-Force-Production-Data header for logged-out users
```

### 2. Environment Configuration Override

**File**: `app/utils/environmentConfig.ts`

The `getCollectionName()` function checks for the `X-Force-Production-Data` header and returns production collection names when present:

```typescript
export const getCollectionName = (baseName: string): string => {
  // Check if we should force production collections via header
  if (shouldUseProductionCollections()) {
    return baseName; // Return base collection name (production data)
  }
  
  const prefix = getEnvironmentPrefix();
  return `${prefix}${baseName}`;
};
```

### 3. Landing Page Components

**Files**:
- `app/components/landing/ActivityCarousel.tsx`
- `app/components/landing/SimpleTrendingCarousel.tsx`
- `app/components/landing/DynamicPagePreviewCard.tsx`
- Any component that fetches data for logged-out users

These components use the production data fetch hook to automatically request production data for logged-out users.

## Data Flow

### For Logged-Out Users (Anywhere in App)

1. **User visits any page** while not authenticated (landing, auth, etc.)
2. **Any component** uses `useProductionDataFetchJson()` hook for data fetching
3. **Hook detects logged-out state** and adds `X-Force-Production-Data: true` header
4. **API request sent** with the special header
5. **API routes** use `getCollectionName()` as normal
6. **Environment config** detects the header and returns production collection names
7. **Production data returned** to logged-out user components

### For Logged-In Users (All Pages)

1. **User is authenticated**
2. **Components use normal fetch** or other data fetching methods
3. **No special header added**
4. **Environment config** uses normal environment detection
5. **Environment-appropriate data returned** (DEV_ collections in development, production collections in production)

## Environment Behavior

| Environment | User State | Collections Used | Reason |
|-------------|------------|------------------|---------|
| Production | Logged out | `pages`, `users` | Normal production behavior |
| Production | Logged in | `pages`, `users` | Normal production behavior |
| Preview | Logged out | `pages`, `users` | Shows production data for testing |
| Preview | Logged in | `pages`, `users` | Shows production data for testing |
| Development | Logged out | `pages`, `users` | **Special case**: Landing page shows production data |
| Development | Logged in | `DEV_pages`, `DEV_users` | Normal development isolation |

## Implementation Details

### Header Name
- **Header**: `X-Force-Production-Data`
- **Value**: `true`
- **Scope**: Automatically added for ALL logged-out users throughout the app

### Affected APIs
The header override works automatically with **any API** that uses `getCollectionName()`:
- `/api/trending`
- `/api/recent-edits/global`
- `/api/pages` (when used by landing page)
- Any future APIs that use the standard collection naming

### Security Considerations
- **Safe**: Only affects data reading, not writing operations
- **Read-only**: Only triggered by logged-out users (no write permissions)
- **Auditable**: Header presence is logged for debugging
- **No authentication bypass**: Doesn't affect user authentication or permissions
- **Automatic**: Works seamlessly across all logged-out user interactions

## Benefits

1. **Zero API Changes**: No need to modify individual API endpoints
2. **Automatic**: Works with any new APIs that use `getCollectionName()`
3. **Comprehensive Coverage**: Affects ALL logged-out users throughout the app
4. **Safe by Design**: Read-only operations only, no risk to production data
5. **Authentic Experience**: Logged-out users see real, engaging content
6. **Environment Isolation**: Developers work with DEV_ collections after authentication
7. **Maintainable**: Single point of control in environment configuration
8. **Auditable**: Easy to track which requests use production data
9. **Future-proof**: Will work seamlessly with separate Firebase projects

## Testing

### To Test Production Data Override

1. **Start local development server**
2. **Visit landing page while logged out**
3. **Check browser network tab** - should see `X-Force-Production-Data: true` header
4. **Verify data** - should see real production pages and activity
5. **Log in** - should switch to development data (DEV_ collections)

### To Verify Normal Development Behavior

1. **Log in to development server**
2. **Navigate to any page**
3. **Check network requests** - should NOT have the special header
4. **Verify data** - should see development data (DEV_ collections)

## Troubleshooting

### Logged-Out User Shows Development Data
- Check that user is logged out
- Verify `useProductionDataFetchJson()` is being used in components
- Check browser network tab for `X-Force-Production-Data` header
- Ensure component is using the production data fetch hook

### Logged-In Users See Production Data in Development
- This should not happen - verify user authentication state
- Check that components are not using `useProductionDataFetchJson()` for logged-in users

### API Errors
- Ensure production Firebase collections exist and are accessible
- Check Firebase security rules allow read access to production collections

## Future Considerations

When migrating to separate Firebase projects per environment:
1. The header system will continue to work
2. `getCollectionName()` will need to be updated to switch Firebase projects instead of collection prefixes
3. The landing page will automatically use the production Firebase project for logged-out users

This architecture provides a clean, maintainable solution that scales with the application's growth.
