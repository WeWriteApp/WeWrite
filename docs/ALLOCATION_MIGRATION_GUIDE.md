# Allocation System Migration Guide

## Overview

This guide helps developers migrate from the legacy allocation system to the new unified architecture. The new system eliminates code duplication, improves performance, and provides better developer experience.

## Quick Migration Checklist

- [ ] Replace manual state management with shared hooks
- [ ] Update component imports to use new unified components
- [ ] Remove duplicated allocation logic
- [ ] Add TypeScript interfaces
- [ ] Update tests to use new patterns
- [ ] Verify error handling works correctly

## Before vs After Examples

### 1. Basic Allocation State Management

#### Before (Legacy)
```typescript
// ❌ Old way - Manual state management
const [currentAllocation, setCurrentAllocation] = useState(0);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchAllocation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/usd/allocate?pageId=${pageId}`);
      const data = await response.json();
      setCurrentAllocation(data.currentAllocation);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (pageId) {
    fetchAllocation();
  }
}, [pageId]);
```

#### After (New System)
```typescript
// ✅ New way - Shared hook with TanStack Query
import { useAllocationState } from '@/hooks/allocation';

const allocationState = useAllocationState(pageId);
// That's it! Automatic caching, loading states, error handling
```

### 2. Allocation Actions

#### Before (Legacy)
```typescript
// ❌ Old way - Manual API calls and state updates
const handleIncrease = async () => {
  try {
    setIsProcessing(true);
    const response = await fetch('/api/usd/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId,
        changeCents: allocationIntervalCents,
        source: 'FloatingBar'
      })
    });
    
    if (!response.ok) {
      throw new Error('Allocation failed');
    }
    
    const data = await response.json();
    setCurrentAllocation(data.currentAllocation);
    
    // Show success notification
    toast({ title: 'Allocation updated' });
  } catch (error) {
    // Handle error
    toast({ title: 'Error', description: error.message });
  } finally {
    setIsProcessing(false);
  }
};
```

#### After (New System)
```typescript
// ✅ New way - Shared hook with batching and error handling
import { useAllocationActions } from '@/hooks/allocation';

const { handleAllocationChange, isProcessing } = useAllocationActions(pageId);

const handleIncrease = (event) => {
  // Automatic batching, optimistic updates, error handling
  handleAllocationChange(1, event);
};
```

### 3. Component Structure

#### Before (Legacy)
```typescript
// ❌ Old way - Duplicated logic in each component
const AllocationBar = ({ pageId, authorId, pageTitle }) => {
  // 200+ lines of duplicated state management
  const [currentAllocation, setCurrentAllocation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [usdBalance, setUsdBalance] = useState(null);
  // ... lots of duplicated logic
  
  return (
    <div>
      {/* Complex JSX with inline logic */}
    </div>
  );
};
```

#### After (New System)
```typescript
// ✅ New way - Clean component using shared hooks
import { useAllocationState, useAllocationActions } from '@/hooks/allocation';
import { AllocationAmountDisplay, AllocationControls } from '@/components/payments';

const AllocationBar = ({ pageId, authorId, pageTitle }) => {
  const allocationState = useAllocationState(pageId);
  const { handleAllocationChange, isProcessing } = useAllocationActions(pageId);
  
  return (
    <div>
      <AllocationAmountDisplay 
        allocationCents={allocationState.currentAllocationCents} 
      />
      <AllocationControls
        onIncrease={(e) => handleAllocationChange(1, e)}
        onDecrease={(e) => handleAllocationChange(-1, e)}
        canIncrease={!isProcessing}
        canDecrease={allocationState.currentAllocationCents > 0}
        isProcessing={isProcessing}
      />
    </div>
  );
};
```

## Step-by-Step Migration Process

### Step 1: Update Imports

#### Replace Old Imports
```typescript
// ❌ Remove these
import { useState, useEffect } from 'react';
import { useUsdBalance } from '@/contexts/UsdBalanceContext';
// ... other manual state management imports
```

#### Add New Imports
```typescript
// ✅ Add these
import { useAllocationState, useAllocationActions } from '@/hooks/allocation';
import { AllocationAmountDisplay, AllocationControls } from '@/components/payments';
```

### Step 2: Replace State Management

#### Remove Manual State
```typescript
// ❌ Remove all of this
const [currentAllocation, setCurrentAllocation] = useState(0);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);
const [isProcessing, setIsProcessing] = useState(false);

useEffect(() => {
  // Remove manual fetch logic
}, [pageId]);
```

#### Add Shared Hooks
```typescript
// ✅ Replace with this
const allocationState = useAllocationState(pageId);
const { handleAllocationChange, isProcessing } = useAllocationActions(pageId);
```

### Step 3: Update Event Handlers

#### Replace Manual Handlers
```typescript
// ❌ Remove complex manual handlers
const handleIncrease = async () => {
  // 20+ lines of manual API calls and state updates
};
```

#### Use Shared Actions
```typescript
// ✅ Simple, consistent handlers
const handleIncrease = (event) => {
  handleAllocationChange(1, event);
};
```

### Step 4: Update JSX

#### Replace Custom JSX
```typescript
// ❌ Remove custom allocation display logic
<div className="allocation-amount">
  {isLoading ? (
    <div>Loading...</div>
  ) : (
    <span>${(currentAllocation / 100).toFixed(2)}/mo</span>
  )}
</div>
```

#### Use Shared Components
```typescript
// ✅ Consistent, reusable components
<AllocationAmountDisplay 
  allocationCents={allocationState.currentAllocationCents} 
/>
```

### Step 5: Add TypeScript (if not already present)

```typescript
// ✅ Add proper typing
interface MyAllocationComponentProps {
  pageId: string;
  authorId?: string;
  pageTitle?: string;
  className?: string;
}

const MyAllocationComponent: React.FC<MyAllocationComponentProps> = ({
  pageId,
  authorId,
  pageTitle,
  className
}) => {
  // Component logic
};
```

### Step 6: Update Tests

#### Before (Legacy Tests)
```typescript
// ❌ Complex mocking of individual state pieces
const mockSetCurrentAllocation = jest.fn();
const mockSetIsLoading = jest.fn();
// ... lots of individual mocks
```

#### After (New Tests)
```typescript
// ✅ Simple hook mocking
import { mockAllocationState, mockAllocationActions } from '@/test-utils/allocation';

mockAllocationState({
  currentAllocationCents: 500,
  isLoading: false,
  error: null
});
```

## Common Migration Patterns

### Pattern 1: UsdAllocationBar → SimpleAllocationBar

```typescript
// ❌ Old
import { UsdAllocationBar } from '@/components/payments/UsdAllocationBar';

<UsdAllocationBar pageId={pageId} />

// ✅ New (UsdAllocationBar now uses the new system internally)
import { UsdAllocationBar } from '@/components/payments/UsdAllocationBar';
// OR
import { SimpleAllocationBar } from '@/components/payments/SimpleAllocationBar';

<UsdAllocationBar pageId={pageId} />
```

### Pattern 2: Custom Allocation Logic → Shared Hooks

```typescript
// ❌ Old - Custom allocation logic
const MyCustomComponent = () => {
  const [allocation, setAllocation] = useState(0);
  // ... custom logic
};

// ✅ New - Use shared hooks
const MyCustomComponent = () => {
  const allocationState = useAllocationState(pageId);
  const { handleAllocationChange } = useAllocationActions(pageId);
  // Leverage shared logic
};
```

### Pattern 3: Manual Error Handling → Automatic Error Handling

```typescript
// ❌ Old - Manual error handling
try {
  const response = await fetch('/api/allocate');
  // ... handle response
} catch (error) {
  setError(error);
  toast({ title: 'Error', description: error.message });
}

// ✅ New - Automatic error handling
const { handleAllocationChange } = useAllocationActions(pageId);
// Errors are handled automatically with user-friendly messages
```

## Troubleshooting Common Issues

### Issue 1: "Hook not found" errors
**Solution**: Make sure you've imported the hooks correctly:
```typescript
import { useAllocationState, useAllocationActions } from '@/hooks/allocation';
```

### Issue 2: TypeScript errors
**Solution**: Use the provided interfaces:
```typescript
import type { AllocationBarProps } from '@/types/allocation';
```

### Issue 3: Tests failing
**Solution**: Update test mocks to use new testing utilities:
```typescript
import { renderWithAllocationProviders } from '@/test-utils/allocation';
```

### Issue 4: Performance issues
**Solution**: The new system should be faster. If you see issues, check that you're not creating multiple instances of the same hook.

## Validation Checklist

After migration, verify:

- [ ] **Functionality**: All allocation features work as before
- [ ] **Performance**: Page loads faster with fewer API calls
- [ ] **Error Handling**: Errors are handled gracefully
- [ ] **Loading States**: Loading indicators work correctly
- [ ] **TypeScript**: No TypeScript errors
- [ ] **Tests**: All tests pass
- [ ] **Accessibility**: Screen readers work correctly
- [ ] **Mobile**: Touch interactions work properly

## Getting Help

If you encounter issues during migration:

1. **Check the documentation**: Review `ALLOCATION_SYSTEM.md` and `ALLOCATION_API_REFERENCE.md`
2. **Look at examples**: Check existing migrated components
3. **Run tests**: Use the test suite to verify functionality
4. **Check TypeScript**: Ensure all types are correct

The new allocation system provides significant improvements in maintainability, performance, and developer experience. Take your time with the migration to ensure everything works correctly!
