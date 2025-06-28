# Subscription Downgrade and Cancellation Handling Implementation

## Overview

This implementation provides comprehensive handling for subscription downgrades and cancellations in the pledge/token allocation system, ensuring data preservation and smooth user experience during subscription changes.

## Core Features Implemented

### 1. Pledge Budget Validation Service (`app/services/pledgeBudgetService.ts`)

**Key Functions:**
- `validatePledgeBudget()` - Validates pledges against subscription budget
- `getUserPledges()` - Retrieves all user pledges with metadata
- `getUserSubscriptionBudget()` - Gets current subscription budget info
- `handleSubscriptionStatusChange()` - Handles subscription status transitions
- `reducePledgeAmount()` - Reduces pledge amounts with history tracking

**Prioritization Logic:**
- Suspends LARGEST pledges first when over budget
- Keeps smaller pledges active to maximize user satisfaction
- Displays pledges in descending order (largest first) for easy management

### 2. Enhanced TokenAllocationBar Component

**New Features:**
- Budget warning banner when pledges exceed subscription budget
- Visual indicators for over-budget status
- "Manage Pledges" button for detailed pledge management
- Real-time budget validation on subscription changes

**Warning States:**
- Red warning banner for over-budget situations
- Clear messaging about suspended pledges
- One-click access to pledge management interface

### 3. Comprehensive Pledge Management Modal (`app/components/payments/PledgeManagementModal.tsx`)

**Features:**
- Budget summary with over-budget indicators
- Pledge list with status badges (Active, Suspended, Over Budget)
- Individual pledge reduction controls
- Quick-fix auto-reduction for largest pledges
- Restoration suggestions for previously suspended pledges
- Mobile-responsive design (Sheet on mobile, Dialog on desktop)

**Pledge Status Indicators:**
- **Active** (Green): Within budget and functioning
- **Suspended** (Yellow): Suspended due to subscription status
- **Over Budget** (Red): Exceeds available budget

### 4. Subscription Status Handling

**Webhook Integration:**
- Automatic pledge validation on subscription changes
- Preserves pledge data during cancellation/downgrade
- Handles reactivation and restoration scenarios

**Status Transitions:**
- **Cancellation**: All pledges suspended but data preserved
- **Downgrade**: Budget validation applied, largest pledges suspended
- **Reactivation**: Pledges restored within new budget constraints

### 5. Pledge History and Restoration

**History Tracking:**
- Complete audit trail of all pledge changes
- Records reason for each change (manual, budget, subscription)
- Tracks subscription status at time of change

**Restoration Features:**
- Automatic suggestions for previously suspended pledges
- Smart restoration within available budget
- One-click restoration of multiple pledges

## User Experience Flow

### Subscription Downgrade Scenario

1. **User downgrades subscription** (e.g., $30/month to $15/month)
2. **System automatically validates** existing pledges against new budget
3. **Largest pledges are suspended** first to fit within new budget
4. **User sees warning banner** in TokenAllocationBar
5. **User can manage pledges** via "Manage Pledges" button
6. **Individual pledges can be reduced** or removed as needed

### Subscription Cancellation Scenario

1. **User cancels subscription**
2. **All pledges are suspended** but data is preserved
3. **User sees clear messaging** about suspended status
4. **Pledge data remains intact** for future reactivation

### Subscription Reactivation Scenario

1. **User reactivates subscription**
2. **System offers restoration suggestions** based on history
3. **Previous pledges can be restored** within new budget
4. **One-click restoration** for multiple pledges

## Technical Implementation Details

### Database Schema

**Token Allocations Collection:**
```typescript
{
  id: string;
  userId: string;
  resourceId: string; // pageId
  tokens: number;
  status: 'active' | 'suspended' | 'over_budget';
  originalAmount?: number; // For restoration
  suspendedAt?: timestamp;
  suspensionReason?: string;
}
```

**Pledge History Collection:**
```typescript
{
  id: string;
  userId: string;
  pageId: string;
  amount: number;
  previousAmount: number;
  action: 'created' | 'increased' | 'decreased' | 'suspended' | 'restored' | 'deleted';
  reason: string;
  subscriptionStatus: string;
  subscriptionAmount: number;
  timestamp: timestamp;
}
```

### API Endpoints

**Enhanced Pledge API** (`/api/tokens/pledge`):
- Supports both token changes and direct amount setting
- Integrates with pledge budget service
- Records history for all changes

**Subscription Webhook** (`/api/webhooks/subscription-status`):
- Handles Stripe subscription events
- Automatically triggers pledge validation
- Updates subscription status in Firestore

## Benefits

### For Users
- **No data loss** during subscription changes
- **Clear visibility** into budget constraints
- **Easy management** of pledges when over budget
- **Automatic restoration** suggestions when upgrading
- **Flexible adjustment** options for individual pledges

### For the Platform
- **Preserved user engagement** through data retention
- **Smooth subscription transitions** without user frustration
- **Comprehensive audit trail** for support and analytics
- **Automated handling** of complex subscription scenarios

## Future Enhancements

1. **Email notifications** for subscription changes affecting pledges
2. **Bulk pledge management** operations
3. **Pledge scheduling** for future subscription upgrades
4. **Advanced restoration algorithms** based on user preferences
5. **Analytics dashboard** for pledge management insights

## Testing Scenarios

1. **Downgrade with over-budget pledges**
2. **Cancellation and reactivation**
3. **Multiple subscription tier changes**
4. **Partial pledge restoration**
5. **Webhook failure recovery**

This implementation ensures that users maintain control over their pledges while providing clear guidance and automated assistance during subscription transitions.
