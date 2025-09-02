# Allocation Rollover System

## Overview

The WeWrite platform implements an **automatic allocation rollover system** that ensures sustainable income streams for writers by maintaining supporter commitments across months. This system creates predictable, recurring support that writers can depend on.

## Core Principle: Sustainable Writer Income

### The Problem
Without rollover, supporters would need to manually re-allocate their budget every month, leading to:
- Inconsistent income for writers
- Supporter fatigue from repeated allocation decisions
- Reduced long-term financial sustainability for creators

### The Solution
**Automatic Rollover**: Previous month's allocations automatically continue into the next month, creating:
- **Predictable Income**: Writers can count on consistent monthly support
- **Sustainable Support**: Supporters set their allocations once and they continue automatically
- **Intentional Changes**: Supporters can adjust when they want to, not because they're forced to

## How It Works

### 1. Monthly Allocation Persistence
```typescript
// Each allocation is stored with month tracking
{
  userId: "supporter_id",
  recipientUserId: "writer_id", 
  resourceId: "page_id",
  usdCents: 500, // $5.00 allocation
  month: "2024-01", // Current month
  status: "active",
  rolledOverFrom: "2023-12" // Tracks rollover history
}
```

### 2. Month-End Processing
At the end of each month, the system:

1. **Locks Current Month**: Finalizes all allocations and payouts
2. **Checks Subscriptions**: Verifies which users have active subscriptions for next month
3. **Rolls Over Allocations**: Automatically creates new allocation records for next month
4. **Maintains History**: Tracks which allocations were rolled over vs newly created

### 3. Rollover Logic
```typescript
// For each user with active subscription
for (const allocation of previousMonthAllocations) {
  // Create identical allocation for next month
  const newAllocation = {
    ...allocation,
    month: nextMonth,
    rolledOverFrom: currentMonth,
    createdAt: serverTimestamp()
  };
  
  // This ensures writers continue receiving support
  await createAllocation(newAllocation);
}
```

## User Experience

### For Supporters
- **Set Once, Support Continuously**: Allocate budget once, it continues automatically
- **Intentional Adjustments**: Change allocations when you want to support different writers
- **No Monthly Chores**: No need to remember to re-allocate every month
- **Clear Control**: Easy to see and modify current allocations at any time

### For Writers
- **Predictable Income**: Know what support to expect each month
- **Sustainable Planning**: Can plan projects based on consistent support
- **Growing Support**: Supporters are more likely to maintain long-term commitments
- **Focus on Creating**: Less worry about month-to-month income fluctuations

## Implementation Details

### Database Structure
```
usdAllocations/
├── {allocationId}
│   ├── userId: string           // Who is allocating
│   ├── recipientUserId: string  // Who receives the allocation
│   ├── resourceId: string       // Which page/content
│   ├── usdCents: number        // Amount in cents
│   ├── month: string           // YYYY-MM format
│   ├── status: string          // active, locked, processed
│   ├── rolledOverFrom?: string // Previous month if rolled over
│   ├── createdAt: timestamp
│   └── updatedAt: timestamp
```

### Key Services
- **`monthlyAllocationLockService.ts`**: Handles month-end processing and rollover
- **`rolloverUserAllocations()`**: Creates new allocations based on previous month
- **`checkUserSubscriptionStatus()`**: Verifies active subscriptions before rollover

## Benefits

### Economic Sustainability
- **Recurring Revenue**: Writers receive consistent monthly income
- **Reduced Churn**: Automatic rollover reduces supporter drop-off
- **Compound Growth**: Easier for supporters to increase allocations over time

### User Experience
- **Simplified Management**: Supporters don't need monthly allocation decisions
- **Intentional Support**: Changes are deliberate, not due to system friction
- **Trust Building**: Consistent support builds stronger creator-supporter relationships

### Platform Health
- **Predictable Revenue**: More stable income for the platform
- **Higher Engagement**: Writers can focus on creating, not fundraising
- **Long-term Relationships**: Encourages sustained creator-supporter connections

## Monitoring & Analytics

The system tracks:
- **Rollover Success Rate**: Percentage of allocations successfully rolled over
- **Subscription Continuity**: How many supporters maintain active subscriptions
- **Allocation Stability**: Month-over-month allocation consistency
- **Writer Income Predictability**: Variance in monthly writer earnings

## Future Enhancements

### Planned Features
- **Allocation Scheduling**: Set future allocation changes in advance
- **Seasonal Adjustments**: Temporary allocation increases for special projects
- **Supporter Notifications**: Gentle reminders about allocation impact
- **Writer Income Forecasting**: Help writers predict future earnings

### Considerations
- **Subscription Lapses**: Handle cases where supporters' subscriptions expire
- **Writer Inactivity**: Policies for allocations to inactive writers
- **Dispute Resolution**: Process for handling allocation-related issues

## Conclusion

The allocation rollover system is fundamental to WeWrite's mission of creating sustainable income for writers. By automatically continuing supporter commitments, we reduce friction for supporters while providing predictable income for creators. This creates a virtuous cycle where writers can focus on creating great content, knowing they have consistent financial support from their community.
