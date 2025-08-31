# Earnings Calculation Fix

## Problem

The earnings calculation system was showing **unfunded allocations** to recipients, creating a financial discrepancy where:

1. **Users could over-allocate** beyond their subscription amount (intentional feature)
2. **Recipients saw the full over-allocated amounts** as earnings
3. **Platform had to cover the shortfall** between what users paid vs. what recipients expected

### Example Issue
- FRANTZ has $20/month subscription (Tier 2)
- FRANTZ allocated $39.50 total ($20 to "Bugs" + $19.50 to "Solved bugs")  
- Recipients saw $39.50 in earnings, but FRANTZ only paid $20
- Platform shortfall: $19.50/month

## Solution

**Recipients now only see funded allocations** - earnings are proportionally reduced based on the sponsor's actual subscription funding.

### Calculation Logic

```typescript
if (sponsorAllocatedCents > sponsorSubscriptionCents) {
  // Sponsor is over-allocated - calculate the funded portion
  const fundingRatio = sponsorSubscriptionCents / sponsorAllocatedCents;
  const fundedAllocationCents = Math.round(allocationCents * fundingRatio);
  usdCents = fundedAllocationCents;
}
```

### Example Fix
- FRANTZ subscription: $20.00
- FRANTZ total allocated: $39.50
- Funding ratio: 50.63% ($20 ÷ $39.50)

**Before Fix:**
- "Bugs" page earnings: $20.00
- "Solved bugs" page earnings: $19.50
- **Total recipient earnings: $39.50**
- **Platform shortfall: $19.50**

**After Fix:**
- "Bugs" page funded earnings: $10.13 ($20.00 × 50.63%)
- "Solved bugs" page funded earnings: $9.87 ($19.50 × 50.63%)
- **Total funded earnings: $20.00**
- **Platform shortfall: $0.00 ✅**

## Implementation

### Files Modified

1. **`app/api/earnings/user/route.ts`**
   - Added funding ratio calculation in `getIncomingAllocationsForUser()`
   - Recipients only see proportionally funded allocations

### Key Features

1. **Over-allocation still allowed** - users can allocate more than their subscription
2. **Orange bars remain private** - only visible to the person making allocations
3. **Recipients see realistic earnings** - only funded portions
4. **Platform financial risk eliminated** - no more shortfalls
5. **Upgrade nudges preserved** - users still see unfunded allocations in their own UI

## User Experience

### For Sponsors (Users Making Allocations)
- Can still over-allocate beyond subscription amount
- See orange "overspent" sections in allocation bars
- Get nudged to upgrade subscription to fund unfunded allocations
- **No change to existing UX**

### For Recipients (Content Creators)
- Only see earnings from funded allocations
- Earnings match actual money available from sponsors
- No more inflated earnings expectations
- **More accurate earnings display**

## Testing

The fix was verified with the FRANTZ scenario:
- Input: $20 subscription, $39.50 allocated
- Output: $20.00 total funded earnings (exactly matches subscription)
- Math verified: ✅ No rounding errors

## Financial Impact

- **Eliminates platform financial risk** from over-allocations
- **Maintains user experience** for allocation flexibility  
- **Provides accurate earnings** to content creators
- **Preserves upgrade incentives** for sponsors
