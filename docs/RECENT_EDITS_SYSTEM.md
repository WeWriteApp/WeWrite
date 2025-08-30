# WeWrite Recent Edits System

## 🎯 **System Overview**

WeWrite uses a **clear, simplified recent edits system** with consistent naming and architecture. This document is the **single source of truth** for understanding how recent edits work.

## 🏗️ **Architecture**

### **API Endpoints**

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `/api/recent-edits/global` | Global recent edits for homepage | `GlobalRecentEdits` component |
| `/api/recent-edits/user` | User-specific recent edits | `UserRecentEdits` component |

### **Components**

| Component | Purpose | Location |
|-----------|---------|----------|
| `GlobalRecentEdits` | Homepage recent edits from all users | `app/components/features/GlobalRecentEdits.tsx` |
| `UserRecentEdits` | User profile recent edits | `app/components/features/UserRecentEdits.tsx` |

### **Data Flow**

```mermaid
graph TD
    A[Homepage] --> B[GlobalRecentEdits]
    B --> C[/api/recent-edits/global]
    C --> D[Pages Collection]
    
    E[User Profile] --> F[UserRecentEdits]
    F --> G[/api/recent-edits/user]
    G --> D[Pages Collection]
    
    D --> H[Environment-Aware Collections]
    H --> I[DEV_pages in development]
    H --> J[pages in production]
```

## 📋 **Implementation Details**

### **Simplified Activity System**

Both APIs use the **simplified activity system** approach:

1. **Query pages collection directly** by `lastModified`
2. **Filter deleted pages in code** (avoids composite index issues)
3. **No complex version system queries**
4. **Environment-aware collection naming**

### **Global Recent Edits API**

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

### **User Recent Edits API**

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

- ✅ **Homepage Recent Edits**: `GlobalRecentEdits` → `/api/recent-edits/global`
- ✅ **User Profile Recent Edits**: `UserRecentEdits` → `/api/recent-edits/user`
- ✅ **Environment Separation**: DEV_ collections in development
- ✅ **Consistent Naming**: Clear, obvious component and API names

### **Removed Legacy Components**

- ❌ `SimpleRecentEdits` → **RENAMED** to `GlobalRecentEdits`
- ❌ `/api/recent-edits` (old) → **MOVED** to `/api/recent-edits/global`
- ❌ `/api/recent-pages` → **MOVED** to `/api/recent-edits/user`

## 🚨 **Critical: Old Patterns to Delete**

### **Deprecated API Calls**

```typescript
// ❌ DELETE THESE - Old API patterns
fetch('/api/recent-edits?filterToUser=userId')  // Use /api/recent-edits/user
fetch('/api/recent-pages?userId=userId')        // Use /api/recent-edits/user

// ✅ CORRECT - New clear API patterns
fetch('/api/recent-edits/global?includeOwn=false')
fetch('/api/recent-edits/user?userId=userId')
```

### **Deprecated Component Imports**

```typescript
// ❌ DELETE THESE - Old component imports
import SimpleRecentEdits from './SimpleRecentEdits';

// ✅ CORRECT - New clear component imports
import GlobalRecentEdits from './GlobalRecentEdits';
import UserRecentEdits from './UserRecentEdits';
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
grep -r "api/recent-edits/global" app/ --include="*.ts" --include="*.tsx"
grep -r "api/recent-edits/user" app/ --include="*.ts" --include="*.tsx"

# Verify new component imports
grep -r "GlobalRecentEdits" app/ --include="*.ts" --include="*.tsx"
```

## 🎯 **Benefits of This System**

### **1. Clear Naming**
- `GlobalRecentEdits` vs `UserRecentEdits` - Purpose is obvious
- `/api/recent-edits/global` vs `/api/recent-edits/user` - Clear distinction

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

- `ENVIRONMENT_ARCHITECTURE.md` - Environment configuration details
- `PAGE_DATA_AND_VERSIONS.md` - Authoritative page data and version system
- `SIMPLIFIED_ACTIVITY_SYSTEM.md` - Background on simplified approach

---

**This document is the single source of truth for WeWrite's recent edits system. All other documentation about recent edits should reference this document.**
