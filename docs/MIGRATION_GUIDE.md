# WeWrite Codebase Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the old overlapping utility systems to the new consolidated implementations.

## 🔄 Migration Map

### API Utilities
```typescript
// OLD - Multiple overlapping files
import { apiCall } from '../utils/apiDeduplication';
import { deduplicatedFetch } from '../utils/requestDeduplication';
import { cachedQuery } from '../utils/globalCache';

// NEW - Single unified client
import { apiClient, getUserData, getPageData } from '../utils/unifiedApiClient';
```

### Error Boundaries
```typescript
// OLD - Multiple implementations
import ErrorBoundary from '../utils/ErrorBoundary';
import { ProductionErrorBoundary } from '../utils/ProductionErrorBoundary';

// NEW - Single unified boundary
import { UnifiedErrorBoundary } from '../utils/UnifiedErrorBoundary';
```

### Modal Components
```typescript
// OLD - Separate modal files
import { AlertModal } from '../utils/AlertModal';
import { ConfirmationModal } from '../utils/ConfirmationModal';
import { PromptModal } from '../utils/PromptModal';

// NEW - Single unified modal with variants
import { UnifiedModal, AlertModal, ConfirmationModal, PromptModal } from '../utils/UnifiedModal';
```

### Cache Systems
```typescript
// OLD - Complex caching systems
import { globalCache, cachedQuery } from '../utils/globalCache';
import { getCacheItem, setCacheItem } from '../utils/cacheUtils';

// NEW - Simple, effective cache
import { cache, cached, cacheUtils } from '../utils/simpleCache';
```

### Form Validation
```typescript
// OLD - Specialized validation components
import { TitleValidationInput } from '../forms/TitleValidationInput';

// NEW - Unified validation with variants
import { UnifiedFormValidation, TitleValidationInput } from '../forms/UnifiedFormValidation';
```

### Utility Functions
```typescript
// OLD - Duplicate utilities across files
import { extractTextContent } from '../utils/text-extraction';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { formatCurrency } from '../utils/formatCurrency';

// NEW - Consolidated utilities
import { 
  extractTextContent, 
  formatRelativeTime, 
  formatCurrency 
} from '../utils/consolidatedUtils';
```

## 📋 Step-by-Step Migration

### 1. API Client Migration

**Find and Replace Patterns:**
```bash
# Find old API calls
grep -r "apiCall\|deduplicatedFetch\|cachedQuery" app --include="*.tsx" --include="*.ts"

# Replace patterns
apiCall('/api/users/123') → apiClient.get('/api/users/123')
deduplicatedFetch(url, options) → apiClient.call(url, options)
cachedQuery(key, fn) → cached(key, fn)
```

**Common Replacements:**
```typescript
// OLD
const data = await apiCall('/api/users/123');
const result = await deduplicatedFetch('/api/pages/456', { method: 'POST', body: JSON.stringify(payload) });

// NEW
const data = await apiClient.get('/api/users/123');
const result = await apiClient.post('/api/pages/456', payload);
```

### 2. Error Boundary Migration

**Component Updates:**
```typescript
// OLD
<ErrorBoundary name="component-name">
  <YourComponent />
</ErrorBoundary>

// NEW
<UnifiedErrorBoundary>
  <YourComponent />
</UnifiedErrorBoundary>
```

**Custom Fallbacks:**
```typescript
// OLD
<ProductionErrorBoundary fallback={<CustomError />}>
  <YourComponent />
</ProductionErrorBoundary>

// NEW
<UnifiedErrorBoundary fallback={({ error, resetError }) => <CustomError error={error} onRetry={resetError} />}>
  <YourComponent />
</UnifiedErrorBoundary>
```

### 3. Modal Migration

**Alert Modals:**
```typescript
// OLD
<AlertModal
  isOpen={isOpen}
  onClose={onClose}
  title="Success"
  message="Operation completed"
  variant="success"
/>

// NEW - Same API, just import from UnifiedModal
<AlertModal
  isOpen={isOpen}
  onClose={onClose}
  title="Success"
  message="Operation completed"
  type="success"
/>
```

**Confirmation Modals:**
```typescript
// OLD
<ConfirmationModal
  isOpen={isOpen}
  onClose={onClose}
  onConfirm={handleConfirm}
  title="Delete Item"
  message="Are you sure?"
  variant="destructive"
/>

// NEW - Same API
<ConfirmationModal
  isOpen={isOpen}
  onClose={onClose}
  onConfirm={handleConfirm}
  title="Delete Item"
  message="Are you sure?"
  type="destructive"
/>
```

### 4. Cache Migration

**Basic Cache Operations:**
```typescript
// OLD
import { getCacheItem, setCacheItem, generateCacheKey } from '../utils/cacheUtils';

const key = generateCacheKey('user', userId);
const cached = getCacheItem(key);
setCacheItem(key, data, 300000);

// NEW
import { cache, cacheKey } from '../utils/simpleCache';

const key = cacheKey('user', userId);
const cached = cache.get(key);
cache.set(key, data, 300000);
```

**Cached Functions:**
```typescript
// OLD
import { cachedQuery } from '../utils/globalCache';

const result = await cachedQuery('user-data', () => fetchUserData(userId));

// NEW
import { cached } from '../utils/simpleCache';

const result = await cached('user-data', () => fetchUserData(userId));
```

### 5. Form Validation Migration

**Title Validation:**
```typescript
// OLD
<TitleValidationInput
  value={title}
  onChange={setTitle}
  excludePageId={pageId}
  onValidationChange={handleValidation}
/>

// NEW - Same API, enhanced functionality
<TitleValidationInput
  value={title}
  onChange={setTitle}
  excludeId={pageId}
  onValidationChange={handleValidation}
/>
```

**Custom Validation:**
```typescript
// NEW - Unified validation with custom rules
<UnifiedFormValidation
  value={email}
  onChange={setEmail}
  validation={{ type: 'email', required: true }}
  label="Email Address"
  onValidationChange={handleValidation}
/>
```

## 🧪 Testing Migration

### 1. Automated Testing
```bash
# Run existing tests
npm test

# Check for TypeScript errors
npm run type-check

# Build to check for issues
npm run build
```

### 2. Manual Testing
- Test all modal types (alert, confirm, prompt)
- Verify error boundaries catch and display errors
- Check API calls work correctly
- Validate form validation behavior
- Test cache functionality

### 3. Performance Testing
- Check bundle size reduction
- Verify loading performance
- Test memory usage
- Monitor network requests

## 🚨 Common Issues

### Import Errors
```typescript
// Error: Cannot find module
import { apiCall } from '../utils/apiDeduplication';

// Solution: Update to new import
import { apiClient } from '../utils/unifiedApiClient';
```

### Type Errors
```typescript
// Error: Property 'variant' does not exist
<AlertModal variant="success" />

// Solution: Use 'type' instead
<AlertModal type="success" />
```

### Cache Key Changes
```typescript
// Old cache keys might not work
const key = generateCacheKey('user', userId); // Complex key generation

// New simplified keys
const key = cacheKey('user', userId); // Simple concatenation
```

## ✅ Verification Checklist

- [ ] All old imports removed
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] Bundle size reduced
- [ ] Performance maintained or improved
- [ ] Error handling works correctly
- [ ] Cache functionality preserved
- [ ] Modal interactions work
- [ ] Form validation behaves correctly

## 🆘 Rollback Plan

If issues arise, you can temporarily revert by:

1. **Keep old files** until migration is fully tested
2. **Use git branches** for migration work
3. **Test thoroughly** before removing old files
4. **Monitor production** after deployment

The old files can be restored from git history if needed:
```bash
git checkout HEAD~1 -- app/utils/apiDeduplication.ts
git checkout HEAD~1 -- app/components/utils/ErrorBoundary.tsx
# etc.
```

## 📞 Support

If you encounter issues during migration:

1. Check this guide for common solutions
2. Review the consolidated component documentation
3. Test with the old implementation to isolate issues
4. Use the cleanup script only after full verification

Remember: The goal is to maintain all functionality while simplifying the codebase. Take your time and test thoroughly!
