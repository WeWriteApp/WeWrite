# Subscription Page Tabbed Interface Implementation

## Overview

The subscription management page has been enhanced with a tabbed interface that separates token purchasing and token spending functionality into two distinct tabs:

1. **"Buy Tokens" tab** - Contains subscription management functionality
2. **"Spend Tokens" tab** - Contains token allocation interface

## Technical Implementation

### Hash-Based URL Routing

The implementation uses the existing hash-based URL routing system:

- `/settings/subscription#buy-tokens` - Buy Tokens tab
- `/settings/subscription#spend-tokens` - Spend Tokens tab
- `/settings/subscription` (no hash) - Defaults to Buy Tokens tab

### Tab Structure

```tsx
<Tabs 
  defaultValue="buy-tokens" 
  urlNavigation="hash" 
  className="space-y-6"
  onValueChange={(value) => {
    // Analytics tracking for tab switches
    trackInteractionEvent(NAVIGATION_EVENTS.TAB_SWITCHED, {
      tab_name: value,
      page_section: 'subscription',
      feature_context: 'payments'
    });
  }}
>
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="buy-tokens" className="flex items-center gap-2">
      <CreditCard className="h-4 w-4" />
      Buy Tokens
    </TabsTrigger>
    <TabsTrigger value="spend-tokens" className="flex items-center gap-2">
      <Coins className="h-4 w-4" />
      Spend Tokens
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="buy-tokens">
    {/* Subscription management content */}
  </TabsContent>
  
  <TabsContent value="spend-tokens">
    {/* Token allocation content */}
  </TabsContent>
</Tabs>
```

## Tab Content

### Buy Tokens Tab

Contains all existing subscription management functionality:

- **Subscription Tier Carousel**: Tier selection and pricing
- **Current Subscription Status**: Active subscription details
- **Payment Methods**: Billing and payment management
- **Subscription Controls**: Cancel, modify, reactivate options
- **Billing History**: Past invoices and payments

### Spend Tokens Tab

Contains token allocation functionality with different states:

#### Active Subscription State
- **Allocation Countdown Timer**: Shows time until allocation deadline
- **Token Allocation Display**: Current token balance and allocation summary
- **Token Allocation Breakdown**: Detailed allocation interface
- **Start-of-Month Explainer**: Explains the processing model

#### Pending Subscription State
- **Preview Interface**: Shows what token allocation will look like
- **Payment Confirmation Message**: Explains tokens will be available after payment
- **Processing Explanation**: Information about the start-of-month model

#### No Subscription State
- **Get Started Interface**: Encourages subscription signup
- **Call-to-Action**: Button linking to Buy Tokens tab
- **Feature Explanation**: Full explanation of the start-of-month processing model

## Navigation Features

### URL State Management

- **Hash-based routing**: Uses `#buy-tokens` and `#spend-tokens` hashes
- **Browser history**: Back/forward buttons work correctly
- **Direct access**: Users can bookmark and share specific tab URLs
- **Default behavior**: No hash defaults to "Buy Tokens" tab

### State Preservation

- **Tab state persistence**: Selected tab remains active after navigation
- **URL consistency**: Hash always matches the active tab
- **Refresh handling**: Page refresh maintains the selected tab

## Analytics Tracking

Tab switches are tracked with the following analytics event:

```typescript
trackInteractionEvent(NAVIGATION_EVENTS.TAB_SWITCHED, {
  tab_name: 'buy-tokens' | 'spend-tokens',
  page_section: 'subscription',
  feature_context: 'payments'
});
```

## Components Used

### New Components
- `AllocationCountdownTimer`: Shows deadline for token allocation adjustments
- `StartOfMonthExplainer`: Explains the start-of-month processing model

### Existing Components (Moved)
- `TokenAllocationDisplay`: Moved from main page to "Spend Tokens" tab
- `TokenAllocationBreakdown`: Moved from main page to "Spend Tokens" tab

### UI Components
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`: From existing UI library
- Icons: `CreditCard` and `Coins` from Lucide React

## Responsive Design

- **Mobile-friendly**: Tabs work well on mobile devices
- **Grid layout**: Two-column tab layout adapts to screen size
- **Touch-friendly**: Tab triggers are appropriately sized for touch

## Feature Flag Integration

The tabbed interface respects the existing payments feature flag:

- Only visible when `payments` feature flag is enabled
- Gracefully handles different subscription states
- Maintains backward compatibility

## Testing

### Automated Tests
- Tab navigation functionality
- Content switching between tabs
- URL hash management
- Analytics event tracking

### Manual Testing
- Browser back/forward navigation
- Direct URL access with hashes
- Tab content verification
- Different subscription states

## Benefits

### User Experience
- **Clear separation**: Distinct interfaces for buying vs. spending tokens
- **Intuitive navigation**: Familiar tab interface pattern
- **Bookmarkable**: Users can bookmark specific tabs
- **Consistent**: Follows existing app navigation patterns

### Development
- **Maintainable**: Clean separation of concerns
- **Extensible**: Easy to add more tabs in the future
- **Consistent**: Uses existing UI components and patterns
- **Tracked**: Proper analytics for user behavior insights

## Future Enhancements

### Potential Additions
- **History tab**: Transaction and allocation history
- **Settings tab**: Token allocation preferences
- **Analytics tab**: Personal spending insights
- **Help tab**: Documentation and support

### Technical Improvements
- **Lazy loading**: Load tab content only when needed
- **Caching**: Cache tab content for better performance
- **Animations**: Smooth transitions between tabs
- **Keyboard navigation**: Enhanced accessibility

## Migration Notes

### Changes Made
- Moved token allocation components from main page to "Spend Tokens" tab
- Added tabbed interface wrapper around existing content
- Implemented hash-based URL routing
- Added analytics tracking for tab switches

### Backward Compatibility
- All existing functionality preserved
- URLs without hashes still work (default to "Buy Tokens")
- Feature flag integration maintained
- No breaking changes to existing APIs

This implementation provides a clean, user-friendly interface that separates the token purchasing and spending workflows while maintaining all existing functionality and adding improved navigation capabilities.
