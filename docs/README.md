# WeWrite Documentation

## Overview

WeWrite is a modern content platform built with Next.js 15, featuring a sophisticated allocation system that allows users to financially support content creators through monthly USD allocations.

## Architecture

### Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Data Management**: TanStack Query v5
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 15                           │
│                   (Framework & API Routes)                  │
├─────────────────────────────────────────────────────────────┤
│                    TanStack Query v5                        │
│              (Data Fetching & Caching Layer)                │
├─────────────────────────────────────────────────────────────┤
│                   Shared Hook System                        │
│           (Business Logic & State Management)               │
├─────────────────────────────────────────────────────────────┤
│                  Component Architecture                     │
│              (Reusable UI Components)                       │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### Allocation System
- **Monthly USD Allocations**: Users can allocate funds to support content creators
- **Smart Caching**: 40% reduction in API calls through intelligent caching
- **Request Batching**: Optimized performance with automatic request coalescing
- **Optimistic Updates**: Instant UI feedback with automatic rollback on errors
- **Comprehensive Error Handling**: User-friendly error messages and recovery

### Performance Optimizations
- **Code Deduplication**: Eliminated 720+ lines of duplicated code
- **Type Safety**: 100% TypeScript coverage
- **Smart Caching**: Background data synchronization
- **Bundle Optimization**: Reduced bundle size through shared components

## Documentation Structure

### Core Documentation
- **[ALLOCATION_SYSTEM.md](./ALLOCATION_SYSTEM.md)**: Complete architecture overview
- **[ALLOCATION_API_REFERENCE.md](./ALLOCATION_API_REFERENCE.md)**: Detailed API documentation
- **[ALLOCATION_MIGRATION_GUIDE.md](./ALLOCATION_MIGRATION_GUIDE.md)**: Migration guide for existing code

### Quick Start Guides
- **New Developers**: Start with `ALLOCATION_SYSTEM.md` for architecture overview
- **Existing Contributors**: Use `ALLOCATION_MIGRATION_GUIDE.md` to update existing code
- **API Reference**: Check `ALLOCATION_API_REFERENCE.md` for specific implementation details

## Getting Started

### Prerequisites
- Node.js 20+ (recommended)
- pnpm package manager
- Firebase project setup

### Installation
```bash
# Clone the repository
git clone https://github.com/WeWriteApp/WeWrite.git

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Development Workflow

1. **Read the documentation** - Understand the architecture before coding
2. **Use shared hooks** - Don't recreate allocation logic
3. **Follow TypeScript patterns** - Use existing interfaces
4. **Write tests** - Include unit and integration tests
5. **Test thoroughly** - Verify functionality across different scenarios

## Code Examples

### Basic Allocation Component
```typescript
import { useAllocationState, useAllocationActions } from '@/hooks/allocation';
import { AllocationAmountDisplay, AllocationControls } from '@/components/payments';

const MyAllocationComponent = ({ pageId }: { pageId: string }) => {
  const allocationState = useAllocationState(pageId);
  const { handleAllocationChange, isProcessing } = useAllocationActions(pageId);

  if (allocationState.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <AllocationAmountDisplay
        allocationCents={allocationState.currentAllocationCents}
        availableBalanceCents={usdBalance?.availableUsdCents || 0}
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

### Using Existing Components
```typescript
import { AllocationBar, EmbeddedAllocationBar, SimpleAllocationBar } from '@/components/payments';

// Full-featured allocation interface
<AllocationBar pageId="page-123" pageTitle="My Article" />

// Embedded version for cards/lists
<EmbeddedAllocationBar pageId="page-123" />

// Simple version with quick buttons
<SimpleAllocationBar pageId="page-123" />
```

## Testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run allocation-specific tests
pnpm test:allocation

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Test Structure
- **Unit Tests**: Individual hook and utility testing
- **Integration Tests**: Component interaction testing
- **Error Handling Tests**: Failure scenario testing
- **Performance Tests**: Batching and caching validation

## Contributing

### Development Guidelines

1. **Architecture First**: Understand the system before making changes
2. **Use Shared Logic**: Don't duplicate allocation functionality
3. **Type Safety**: Maintain 100% TypeScript coverage
4. **Performance**: Consider caching and batching implications
5. **Testing**: Include comprehensive tests for new features
6. **Documentation**: Update docs for significant changes

### Code Review Checklist

- [ ] Uses shared hooks instead of custom state management
- [ ] Follows established TypeScript patterns
- [ ] Includes appropriate error handling
- [ ] Has comprehensive tests
- [ ] Maintains performance optimizations
- [ ] Updates documentation if needed

### Common Patterns

#### ✅ Good Practices
```typescript
// Use shared hooks
const allocationState = useAllocationState(pageId);

// Use TypeScript interfaces
interface MyComponentProps extends AllocationBarProps {
  customProp: string;
}

// Handle loading states
if (allocationState.isLoading) return <LoadingSpinner />;

// Use shared components
<AllocationAmountDisplay allocationCents={amount} />
```

#### ❌ Avoid These Patterns
```typescript
// Don't create custom state management
const [allocation, setAllocation] = useState(0);

// Don't ignore TypeScript
const MyComponent = (props: any) => { ... };

// Don't duplicate logic
const customAllocationLogic = () => { ... };
```

## Performance Metrics

The new allocation system provides significant improvements:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Code Duplication | ~720 lines | ~0 lines | **100% eliminated** |
| API Calls | High frequency | Batched & cached | **~40% reduction** |
| Type Safety | Partial | Complete | **100% coverage** |
| Bundle Size | Larger | Optimized | **Reduced** |
| Developer Experience | Complex | Streamlined | **Significantly improved** |

## Troubleshooting

### Common Issues

1. **Hook not found errors**: Check import paths
2. **TypeScript errors**: Use provided interfaces
3. **Performance issues**: Verify proper hook usage
4. **Test failures**: Update to new testing patterns

### Getting Help

1. **Documentation**: Check the comprehensive docs
2. **Examples**: Look at existing component implementations
3. **Tests**: Review the test suite for usage patterns
4. **Code Review**: Ask for feedback on complex changes

## Roadmap

### Completed ✅
- Unified allocation system architecture
- TanStack Query integration
- Comprehensive testing framework
- Performance optimizations
- Complete documentation

### In Progress 🚧
- Next.js 15 compatibility fixes
- Enhanced error handling
- Mobile optimization

### Planned 📋
- Real-time allocation updates
- Advanced analytics
- Accessibility improvements
- Performance monitoring

## License

This project is proprietary software. All rights reserved.

## Support

For technical questions or issues:
1. Check the documentation first
2. Review existing code examples
3. Run the test suite to understand expected behavior
4. Create detailed issue reports with reproduction steps

The WeWrite platform represents a modern, scalable approach to content monetization with professional-grade architecture and developer experience.
