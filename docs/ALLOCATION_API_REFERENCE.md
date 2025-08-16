# Allocation System API Reference

## Shared Hooks

### `useAllocationState(pageId?: string)`

Manages allocation data and loading states using TanStack Query.

**Parameters:**
- `pageId` (optional): The page ID to fetch allocation data for

**Returns:**
```typescript
{
  currentAllocationCents: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**Example:**
```typescript
const allocationState = useAllocationState('page-123');
console.log(allocationState.currentAllocationCents); // 500 (= $5.00)
```

### `useAllocationActions(pageId?: string)`

Handles allocation changes with intelligent batching and optimistic updates.

**Parameters:**
- `pageId` (optional): The page ID for allocation actions

**Returns:**
```typescript
{
  handleAllocationChange: (intervalMultiplier: number, event?: Event) => Promise<void>;
  isProcessing: boolean;
  lastError: Error | null;
}
```

**Example:**
```typescript
const { handleAllocationChange, isProcessing } = useAllocationActions('page-123');

// Increase allocation by $0.50 (using default $0.50 interval)
await handleAllocationChange(1);

// Decrease allocation by $0.50 (using default $0.50 interval)
await handleAllocationChange(-1);

// Increase allocation by $1.00 (2x the default interval)
await handleAllocationChange(2);
```

### `useAllocationInterval()`

Manages user allocation interval preferences. The allocation interval determines how much each plus/minus button click changes the allocation amount.

**Default Interval:** $0.50 (50 cents)

**Available Intervals:**
- $0.01 (1 cent)
- $0.10 (10 cents)
- $0.50 (50 cents) - **Default**
- $1.00 (100 cents)
- $5.00 (500 cents)
- $10.00 (1000 cents)

**Returns:**
```typescript
{
  allocationIntervalCents: number;  // Current interval in cents (default: 50)
  isLoading: boolean;
  setAllocationInterval: (cents: number) => Promise<void>;
}
```

**Example:**
```typescript
const { allocationIntervalCents, setAllocationInterval } = useAllocationInterval();

console.log(allocationIntervalCents); // 50 (= $0.50 default)

// Change to $1.00 increments
await setAllocationInterval(100);
```

## Core Components

### `AllocationBar`

Full-featured allocation interface with composition bar and controls.

**Props:**
```typescript
interface AllocationBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
  variant?: 'default' | 'simple' | 'user';
  isUserAllocation?: boolean;
  username?: string;
}
```

**Usage:**
```tsx
<AllocationBar
  pageId="page-123"
  pageTitle="My Article"
  authorId="author-456"
  variant="default"
/>
```

### `EmbeddedAllocationBar`

Simplified allocation bar for embedding within other components.

**Props:**
```typescript
interface EmbeddedAllocationBarProps {
  pageId: string;
  authorId?: string;
  pageTitle?: string;
  className?: string;
}
```

**Usage:**
```tsx
<EmbeddedAllocationBar
  pageId="page-123"
  authorId="author-456"
  className="my-custom-class"
/>
```

### `SimpleAllocationBar` / `UsdAllocationBar`

Quick allocation interface with preset amount buttons.

**Props:**
```typescript
interface SimpleAllocationBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
  isUserAllocation?: boolean;
  username?: string;
}
```

**Usage:**
```tsx
<SimpleAllocationBar
  pageId="page-123"
  pageTitle="Quick Article"
/>
```

## Utility Components

### `AllocationAmountDisplay`

Displays allocation amounts with consistent formatting.

**Props:**
```typescript
interface AllocationAmountDisplayProps {
  allocationCents: number;
  availableBalanceCents?: number;
  variant?: 'page' | 'user';
  className?: string;
  flashType?: 'accent' | 'red' | null;
  allocationIntervalCents?: number;
}
```

**Usage:**
```tsx
<AllocationAmountDisplay
  allocationCents={500} // Displays "$5.00/mo to page"
  availableBalanceCents={3000} // Shows "Available: $30.00" when allocation is 0
  variant="page"
  className="text-lg font-bold"
/>
```

### `AllocationControls`

Reusable increment/decrement controls.

**Props:**
```typescript
interface AllocationControlsProps {
  onIncrease: (event: Event) => void;
  onDecrease: (event: Event) => void;
  canIncrease: boolean;
  canDecrease: boolean;
  isProcessing: boolean;
  className?: string;
}
```

## Batching System

### `AllocationBatcher`

Intelligent request batching and coalescing system.

**Configuration:**
```typescript
interface BatcherConfig {
  maxBatchSize?: number;        // Default: 5
  maxWaitTime?: number;         // Default: 100ms
  minWaitTime?: number;         // Default: 10ms
  adaptiveDelay?: boolean;      // Default: false
  enableCoalescing?: boolean;   // Default: true
  maxRetries?: number;          // Default: 2
}
```

**Usage:**
```typescript
const batcher = new AllocationBatcher({
  maxBatchSize: 10,
  maxWaitTime: 200,
  enableCoalescing: true
});

// Requests are automatically batched and coalesced
await batcher.batchRequest({
  pageId: 'page-123',
  changeCents: 100,
  source: 'FloatingBar'
});
```

## Error Handling

### `AllocationErrorHandler`

Centralized error handling with user-friendly messages.

**Methods:**
```typescript
class AllocationErrorHandler {
  static handleAllocationError(error: Error, context: AllocationContext): AllocationErrorResult;
  static getErrorFrequency(errorType: string): number;
  static shouldShowError(error: Error): boolean;
}
```

**Error Types:**
- `INSUFFICIENT_FUNDS`: User doesn't have enough balance
- `NETWORK_ERROR`: Connection or server issues
- `VALIDATION_ERROR`: Invalid allocation parameters
- `RATE_LIMIT_ERROR`: Too many requests
- `UNKNOWN_ERROR`: Unexpected errors

## TypeScript Interfaces

### Core Types

```typescript
interface AllocationRequest {
  pageId: string;
  changeCents: number;
  source: 'FloatingBar' | 'EmbeddedBar' | 'QuickActions';
}

interface AllocationResponse {
  success: boolean;
  currentAllocation: number;
  error?: string;
}

interface AllocationState {
  currentAllocationCents: number;
  isLoading: boolean;
  error: Error | null;
}

interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
  allocationCount: number;
}
```

### Component Props

```typescript
interface FloatingAllocationBarProps {
  pageId?: string;
  pageTitle?: string;
  authorId?: string;
  visible?: boolean;
  className?: string;
}

interface AllocationCompositionData {
  totalAllocatedCents: number;
  userAllocationCents: number;
  isOutOfFunds: boolean;
  allocationPercentage: number;
}
```

## API Endpoints

### `GET /api/usd/allocate?pageId={pageId}`

Fetch current allocation for a page.

**Response:**
```typescript
{
  currentAllocation: number; // Allocation in cents
}
```

### `POST /api/usd/allocate`

Update allocation for a page.

**Request Body:**
```typescript
{
  pageId: string;
  changeCents: number;
  source: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  currentAllocation: number;
  error?: string;
}
```

### `GET /api/usd/balance`

Get user's USD balance information.

**Response:**
```typescript
{
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
  allocationCount: number;
}
```

## Best Practices

### 1. Always Use Shared Hooks
```typescript
// ✅ Good
const allocationState = useAllocationState(pageId);

// ❌ Bad - Don't create custom state management
const [allocation, setAllocation] = useState(0);
```

### 2. Handle Loading States
```typescript
// ✅ Good
if (allocationState.isLoading) {
  return <LoadingSpinner />;
}

// ❌ Bad - Don't ignore loading states
return <div>{allocationState.currentAllocationCents}</div>;
```

### 3. Implement Error Boundaries
```typescript
// ✅ Good
<ErrorBoundary fallback={<AllocationErrorFallback />}>
  <AllocationBar pageId={pageId} />
</ErrorBoundary>
```

### 4. Use TypeScript Interfaces
```typescript
// ✅ Good
interface MyComponentProps extends AllocationBarProps {
  customProp: string;
}

// ❌ Bad - Don't use any types
const MyComponent = (props: any) => { ... };
```

## Testing Utilities

### Mock Hooks
```typescript
// Test utilities available
import { mockAllocationState, mockAllocationActions } from '@/test-utils/allocation';

// Mock allocation state for testing
mockAllocationState({
  currentAllocationCents: 500,
  isLoading: false,
  error: null
});
```

### Test Helpers
```typescript
// Helper functions for testing
import { renderWithAllocationProviders, createMockAllocationData } from '@/test-utils';
```

This API reference provides comprehensive documentation for developers working with the allocation system. All components, hooks, and utilities follow these established patterns for consistency and maintainability.
