# WeWrite Refactoring Opportunities

## 🎯 **High Priority Refactoring Opportunities**

### 1. **Large Component Decomposition**

#### PageView.tsx (1,758 lines) - CRITICAL
**Current Issues:**
- 42+ hooks and callbacks in a single component
- Multiple responsibilities (editing, viewing, saving, validation)
- Complex state management with interdependent states
- Difficult to test and maintain

**Refactoring Strategy:**
```
PageView.tsx → Split into:
├── PageViewContainer.tsx (main orchestrator)
├── hooks/
│   ├── usePageData.ts (data fetching & state)
│   ├── usePageEditing.ts (editing logic)
│   ├── usePageSaving.ts (save operations)
│   └── usePageValidation.ts (title/content validation)
├── components/
│   ├── PageViewHeader.tsx
│   ├── PageViewContent.tsx
│   ├── PageViewFooter.tsx
│   └── PageViewActions.tsx
```

#### new/page.tsx (1,399 lines) - HIGH
**Similar decomposition needed for page creation flow**

### 2. **Custom Hook Extraction**

#### Common Loading/Error State Pattern
**Found in 10+ components:**
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Refactor to:**
```typescript
// hooks/useAsyncState.ts
export function useAsyncState<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { data, loading, error, execute, setData };
}
```

#### API Call Pattern
**Found in 15+ components:**
```typescript
const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    const result = await apiCall();
    setData(result);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
}, []);
```

**Refactor to:**
```typescript
// hooks/useApiCall.ts
export function useApiCall<T>(apiFunction: () => Promise<T>) {
  const { data, loading, error, execute } = useAsyncState<T>();
  
  const refetch = useCallback(() => execute(apiFunction), [apiFunction, execute]);
  
  useEffect(() => {
    refetch();
  }, [refetch]);
  
  return { data, loading, error, refetch };
}
```

### 3. **Service Layer Consolidation**

#### Dashboard Analytics (1,426 lines)
**Current Issues:**
- Monolithic service with multiple responsibilities
- Complex data transformation logic mixed with API calls
- Difficult to test individual functions

**Refactor to:**
```
services/dashboard/
├── DashboardDataService.ts (API calls)
├── DashboardTransformService.ts (data transformation)
├── DashboardCacheService.ts (caching logic)
└── DashboardAnalyticsService.ts (main orchestrator)
```

### 4. **Component Composition Patterns**

#### Repeated Card Patterns
**Found in 20+ components:**
```typescript
<div className="wewrite-card p-4">
  {loading ? <LoadingSpinner /> : content}
</div>
```

**Refactor to:**
```typescript
// components/ui/AsyncCard.tsx
export function AsyncCard({ 
  loading, 
  error, 
  children, 
  className 
}: AsyncCardProps) {
  return (
    <div className={cn("wewrite-card p-4", className)}>
      {loading && <LoadingSpinner />}
      {error && <ErrorDisplay error={error} />}
      {!loading && !error && children}
    </div>
  );
}
```

### 5. **State Management Optimization**

#### Form State Patterns
**Found in 8+ forms:**
```typescript
const [title, setTitle] = useState('');
const [titleError, setTitleError] = useState('');
const [isTitleValid, setIsTitleValid] = useState(true);
```

**Refactor to:**
```typescript
// hooks/useFormField.ts
export function useFormField(
  initialValue: string = '',
  validator?: (value: string) => string | null
) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  
  const validate = useCallback((val: string) => {
    if (validator) {
      const errorMsg = validator(val);
      setError(errorMsg);
      return !errorMsg;
    }
    return true;
  }, [validator]);
  
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (touched) validate(newValue);
  }, [touched, validate]);
  
  const handleBlur = useCallback(() => {
    setTouched(true);
    validate(value);
  }, [value, validate]);
  
  return {
    value,
    error,
    touched,
    isValid: !error,
    onChange: handleChange,
    onBlur: handleBlur,
    reset: () => {
      setValue(initialValue);
      setError(null);
      setTouched(false);
    }
  };
}
```

## 🔧 **Medium Priority Opportunities**

### 6. **Utility Function Consolidation**

#### Date Formatting
**Found scattered across 15+ files:**
```typescript
// Consolidate into utils/dateUtils.ts
export const formatters = {
  relative: (date: Date) => formatDistanceToNow(date),
  absolute: (date: Date) => format(date, 'MMM d, yyyy'),
  time: (date: Date) => format(date, 'h:mm a'),
  // ... other formatters
};
```

#### API Response Handling
**Repeated error handling patterns:**
```typescript
// utils/apiUtils.ts
export function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

export function withErrorHandling<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  return apiCall().catch(error => {
    console.error('API Error:', error);
    throw new Error('Something went wrong. Please try again.');
  });
}
```

### 7. **Type Safety Improvements**

#### Generic Component Props
**Many components lack proper TypeScript generics:**
```typescript
// Before
interface CardProps {
  data: any;
  onSelect: (item: any) => void;
}

// After
interface CardProps<T> {
  data: T;
  onSelect: (item: T) => void;
}
```

### 8. **Performance Optimizations**

#### Memoization Opportunities
**Heavy computation in render cycles:**
```typescript
// Before
const expensiveValue = heavyComputation(props.data);

// After
const expensiveValue = useMemo(
  () => heavyComputation(props.data),
  [props.data]
);
```

## 📋 **Implementation Priority**

### Phase 1 (Immediate - High Impact)
1. Extract `useAsyncState` and `useApiCall` hooks
2. Create `AsyncCard` component
3. Implement `useFormField` hook

### Phase 2 (Next Sprint - Large Components)
1. Refactor `PageView.tsx` into smaller components
2. Split `new/page.tsx` into manageable pieces
3. Break down `dashboardAnalytics.ts` service

### Phase 3 (Ongoing - Incremental)
1. Consolidate utility functions
2. Improve TypeScript generics
3. Add performance optimizations

## 🎯 **Success Metrics**

- **Component Size**: No component > 500 lines
- **Hook Complexity**: Max 10 hooks per component
- **Code Reuse**: 80% reduction in duplicate patterns
- **Type Safety**: 100% TypeScript strict mode compliance
- **Performance**: 20% reduction in re-renders

## 🚀 **Getting Started**

1. Start with Phase 1 hooks - immediate impact, low risk
2. Create examples in a new component to validate patterns
3. Gradually migrate existing components
4. Update documentation as patterns are established

---

## 🎯 **Recent Improvements**

### Bank Account Status Enhancement (Completed)
**Issue**: Users going through Stripe bank setup flow saw "Add Bank Account" button even after setup, when Stripe required additional verification (identity confirmation, etc.). This made users think they lost progress.

**Solution**: Enhanced `SimpleBankAccountManager` component to handle all Stripe Connect account states:
- **Verified**: Green badge, "Edit Bank Connection" button
- **Requires Action**: Red badge, "Continue Setup" button with detailed requirements list
- **Pending**: Yellow badge, "Update Information" button with verification status
- **None**: Default "Add Bank Account" button

**Technical Details**:
- Added comprehensive status mapping from Stripe API data
- Implemented user-friendly requirement descriptions
- Added proper error states and progress indicators
- Enhanced UX with contextual button text and colors

**Files Modified**:
- `app/components/payments/SimpleBankAccountManager.tsx` - Enhanced status handling
- Added helper functions for status display and requirement formatting

### Centralized Width Management System (Completed)
**Issue**: FloatingFinancialHeader appeared wider than body content on NavPages due to inconsistent width and padding management across components.

**Root Cause**: No centralized width management system led to:
- **Padding Inconsistencies**: FloatingFinancialHeader used different responsive padding than NavPageLayout
- **Width Overrides**: Various pages used custom max-width values without central coordination
- **Maintenance Issues**: Width constants scattered across multiple files

**Solution**: Created comprehensive centralized width management system:

**🏗️ New Centralized System**:
- **`app/constants/layout.ts`** - Central layout constants and utilities
- **`PAGE_MAX_WIDTH`** - Standard 1024px (max-w-4xl) for all pages
- **`RESPONSIVE_PADDING_CLASSES`** - Consistent `px-4 sm:px-6 lg:px-8` padding
- **`getContainerStylesWithSidebar()`** - Utility for sidebar-aware containers

**🔧 Component Updates**:
- **NavPageLayout** - Now uses centralized constants and types
- **FloatingFinancialHeader** - Uses centralized padding and width utilities
- **Admin Pages** - Migrated custom widths to standard `max-w-4xl`

**📊 Width Audit Results**:
- **✅ Standard Pages** (all use `max-w-4xl`): Home, Search, Notifications, Recents, Random Pages, Trending Pages, Following
- **✅ Special Cases**: Timeline uses `maxWidth="full"` for carousel (intentional)
- **✅ Fixed Inconsistencies**:
  - Trending: `max-w-5xl` → `max-w-4xl`
  - Admin Landing Cards: `max-w-6xl` → `max-w-4xl`
  - FloatingFinancialHeader: Fixed responsive padding

**Design Decision**: All NavPages use consistent `max-w-4xl` (1024px) with responsive padding managed centrally for perfect visual alignment.

**Files Modified**:
- `app/constants/layout.ts` - **NEW** centralized layout system
- `app/components/layout/NavPageLayout.tsx` - Uses centralized constants
- `app/components/layout/FloatingFinancialHeader.tsx` - Uses centralized utilities
- `app/trending/TrendingPageClient.tsx` - Fixed max-width from 5xl to 4xl
- `app/admin/landing-page-cards/page.tsx` - Fixed max-width from 6xl to 4xl
- `app/globals.css` - Updated comments to reference centralized system

---

*This refactoring plan prioritizes maintainability, developer experience, and code reuse while minimizing risk through incremental changes.*
