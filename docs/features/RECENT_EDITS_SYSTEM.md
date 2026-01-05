# WeWrite Activity Feed System

## 🎯 **System Overview**

WeWrite uses a **unified activity feed system** with a single `ActivityFeed` component that handles all activity display via filtered states. This document is the **single source of truth** for understanding how the activity feed works.

## 🏗️ **Architecture**

### **API Endpoints**

| Endpoint | Purpose | Used By | Display Name |
|----------|---------|---------|--------------|
| `/api/activity-feed/global` | Global activity feed for homepage | `ActivityFeed` component (mode="global") | "Activity Feed" |
| `/api/activity-feed/user` | User-specific activity feed | `ActivityFeed` component (mode="user") | "{username}'s Recent Activity" |

> **Note**: Legacy endpoints `/api/recent-edits/global` and `/api/recent-edits/user` are kept for backward compatibility and re-export from the activity-feed routes.

### **Components**

| Component | Purpose | Location | Usage |
|-----------|---------|----------|-------|
| `ActivityFeed` | Unified activity feed | `app/components/features/ActivityFeed.tsx` | `<ActivityFeed mode="global" />` or `<ActivityFeed mode="user" filterByUserId={userId} />` |
| `ActivitySection` | Wrapper for layouts | `app/components/activity/ActivitySection.tsx` | `<ActivitySection />` |

### **Data Flow**

```mermaid
graph TD
    A[Homepage] --> B[ActivityFeed mode=global]
    B --> C[/api/activity-feed/global]
    C --> D[Pages Collection]

    E[User Profile] --> F[ActivityFeed mode=user]
    F --> G[/api/activity-feed/user]
    G --> D[Pages Collection]

    D --> H[Environment-Aware Collections]
    H --> I[DEV_pages in development]
    H --> J[pages in production]
```

### **Activity Types**

See `ACTIVITY_TYPES.md` for detailed documentation on current and planned activity types.

## 📋 **Implementation Details**

### **Simplified Activity Feed System**

Both APIs use the **simplified activity feed** approach:

1. **Query pages collection directly** by `lastModified`
2. **Filter deleted pages in code** (avoids composite index issues)
3. **No complex version system queries**
4. **Environment-aware collection naming**

### **Global Activity Feed API**

```typescript
// /api/recent-edits/global
GET /api/recent-edits/global?limit=15&includeOwn=false&userId=dev_admin_user

// Query Logic:
db.collection(getCollectionName('pages'))
  .where('isPublic', '==', true)
  .where('deleted', '!=', true)
  .orderBy('deleted')
  .orderBy('lastModified', 'desc')
  .limit(limit * 3)
```

### **User Recent Activity API**

```typescript
// /api/recent-edits/user
GET /api/recent-edits/user?userId=dev_admin_user&limit=20

// Query Logic:
db.collection(getCollectionName('pages'))
  .where('userId', '==', userId)
  .orderBy('lastModified', 'desc')
  .limit(limit * 2)
```

## 🌍 **Environment System**

### **Collection Naming**

| Environment | Collection Name | Example |
|-------------|----------------|---------|
| **Local Development** | `DEV_pages` | `getCollectionName('pages')` → `'DEV_pages'` |
| **Vercel Preview** | `pages` | `getCollectionName('pages')` → `'pages'` |
| **Vercel Production** | `pages` | `getCollectionName('pages')` → `'pages'` |

### **Environment Detection**

```typescript
// Automatic environment detection
const environmentType = detectEnvironmentType();
// Returns: 'development' | 'preview' | 'production'

// Collection names are automatically prefixed
const collectionName = getCollectionName('pages');
// Development: 'DEV_pages'
// Preview/Production: 'pages'
```

## ✅ **Current Status**

### **Working Components**

- ✅ **Homepage Activity Feed**: `<ActivityFeed mode="global" />` → `/api/activity-feed/global` (displays as "Activity Feed")
- ✅ **User Profile Recent Activity**: `<ActivityFeed mode="user" filterByUserId={userId} />` → `/api/activity-feed/user` (displays as "Recent Activity" tab)
- ✅ **Environment Separation**: DEV_ collections in development
- ✅ **Unified Component**: Single `ActivityFeed` component with mode prop

### **Removed Legacy Components**

- ❌ `SimpleRecentEdits` → **DELETED**
- ❌ `GlobalRecentEdits` → **DELETED** (consolidated into `ActivityFeed`)
- ❌ `UserRecentEdits` → **DELETED** (consolidated into `ActivityFeed`)
- ❌ `/api/recent-edits` (old) → **DEPRECATED** (use `/api/activity-feed/global`)
- ❌ `/api/recent-pages` → **DEPRECATED** (use `/api/activity-feed/user`)

### **UI Naming Convention**

| Location | Old Name | New Name |
|----------|----------|----------|
| Homepage section | "Recent Edits" | "Activity Feed" |
| User profile tab | "Recent Edits" | "Recent Activity" |
| User profile section title | "{username}'s Recent Edits" | "{username}'s Recent Activity" |

## 🚨 **Critical: Old Patterns to Delete**

### **Deprecated API Calls**

```typescript
// ❌ DELETE THESE - Old API patterns
fetch('/api/recent-edits?filterToUser=userId')  // Use /api/activity-feed/user
fetch('/api/recent-pages?userId=userId')        // Use /api/activity-feed/user

// ✅ CORRECT - New API patterns
fetch('/api/activity-feed/global?includeOwn=false')
fetch('/api/activity-feed/user?userId=userId')
```

### **Deprecated Component Imports**

```typescript
// ❌ DELETE THESE - Old component imports
import SimpleRecentEdits from './SimpleRecentEdits';
import GlobalRecentEdits from './GlobalRecentEdits';
import UserRecentEdits from './UserRecentEdits';

// ✅ CORRECT - Unified component import
import ActivityFeed from './ActivityFeed';

// Usage:
<ActivityFeed mode="global" />
<ActivityFeed mode="user" filterByUserId={userId} filterByUsername={username} />
```

### **Deprecated Activities System**

```typescript
// ❌ DELETE THESE - Old activities collection approach
db.collection('activities').where('userId', '==', userId)
db.collection(getCollectionName('activities'))
db.collectionGroup('versions').orderBy('createdAt', 'desc')

// ✅ CORRECT - Simplified pages collection approach
db.collection(getCollectionName('pages')).orderBy('lastModified', 'desc')
```

## 🔍 **Cleanup Commands**

### **Find Old Patterns**

```bash
# Find old API calls
grep -r "api/recent-edits.*filterToUser" app/ --include="*.ts" --include="*.tsx"
grep -r "api/recent-pages" app/ --include="*.ts" --include="*.tsx"

# Find old component imports
grep -r "SimpleRecentEdits" app/ --include="*.ts" --include="*.tsx"

# Find activities collection references
grep -r "collection.*activities" app/ --include="*.ts" --include="*.tsx"
```

### **Verify New System**

```bash
# Verify new API calls
grep -r "api/activity-feed/global" app/ --include="*.ts" --include="*.tsx"
grep -r "api/activity-feed/user" app/ --include="*.ts" --include="*.tsx"

# Verify unified component usage
grep -r "ActivityFeed" app/ --include="*.ts" --include="*.tsx"
```

## 🎯 **Benefits of This System**

### **1. Unified Component**
- Single `ActivityFeed` component handles all modes via props
- `mode="global"` for homepage, `mode="user"` for profile pages
- "Activity Feed" and "Recent Activity" - User-friendly, expandable naming

### **2. Consistent Architecture**
- Both APIs use same simplified approach
- Both use environment-aware collection naming
- Both filter deleted pages in code

### **3. Maintainable Code**
- Single source of truth documentation
- Clear separation of concerns
- Easy to understand for new developers

### **4. Environment Safety**
- Bulletproof separation between dev/preview/production
- Automatic collection prefixing
- No risk of cross-environment data contamination

### **5. Expandable Activity Types**
- Current: Page edits with diffs
- Future: New page creation, bio updates, follows, comments
- See `ACTIVITY_TYPES.md` for full activity type documentation

## 🚀 **Future Improvements**

### **Potential Enhancements**
1. **Pagination**: Add cursor-based pagination to user recent edits
2. **Caching**: Add Redis caching for frequently accessed data
3. **Real-time**: Add WebSocket updates for live recent edits
4. **Search**: Add search functionality to user recent edits

### **Migration Path**
If we need to move to separate Firebase projects:
1. Update `environmentConfig.ts` with new project IDs
2. Remove collection prefixes (all environments use base names)
3. Keep all `getCollectionName()` calls (they'll return base names)
4. **Zero code changes** in components and APIs

## 📚 **Related Documentation**

- `ACTIVITY_TYPES.md` - Detailed documentation of activity types and their data structures
- `ACTIVITY_SYSTEM_ARCHITECTURE.md` - Technical architecture of the activity system
- `ENVIRONMENT_ARCHITECTURE.md` - Environment configuration details
- `PAGE_DATA_AND_VERSIONS.md` - Authoritative page data and version system

---

**This document is the single source of truth for WeWrite's activity feed system. All other documentation about the activity feed should reference this document.**
