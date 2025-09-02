# WeWrite Notification System

## Overview

WeWrite's notification system provides real-time updates to users about important events and interactions. The system is designed to be scalable, user-friendly, and aligned with WeWrite's actual functionality.

## Notification Types

### User Interaction Notifications

#### 1. User Follow (`follow`)
- **Trigger**: When a user follows another user
- **Message**: "{username} started following you"
- **Criticality**: `normal`
- **Note**: Users can only follow other users, not pages

#### 2. Page Mention (`link`)
- **Trigger**: When a user links to your page from their page
- **Message**: "{username} linked to your page '{page_title}'"
- **Criticality**: `normal`
- **Implementation**: Created automatically when backlinks are updated

#### 3. Page Addition (`append`)
- **Trigger**: When a user adds your page to their page content
- **Message**: "{username} added your page '{source_page}' to '{target_page}'"
- **Criticality**: `normal`

### System Notifications

#### 4. Email Verification (`email_verification`)
- **Trigger**: When user needs to verify their email address
- **Message**: "Please verify your email address to access all features"
- **Criticality**: `device` (highest priority)
- **Action**: Links to settings page

#### 5. System Announcements (`system_announcement`)
- **Trigger**: Platform-wide announcements from administrators
- **Message**: Custom message content
- **Criticality**: `device`

### Payment Notifications

#### 6. Payment Failed (`payment_failed`)
- **Trigger**: When subscription payment fails
- **Message**: "Your subscription payment of ${amount} failed. Please update your payment method."
- **Criticality**: `device`
- **Variants**: 
  - `payment_failed_warning` - First failure
  - `payment_failed_final` - Final notice before cancellation

### Payout Notifications

#### 7. Payout Completed (`payout_completed`)
- **Trigger**: When payout is successfully processed
- **Message**: "Your payout of ${amount} has been processed"
- **Criticality**: `normal`

#### 8. Payout Failed (`payout_failed`)
- **Trigger**: When payout processing fails
- **Message**: "There was an issue processing your payout of ${amount}"
- **Criticality**: `device`

#### 9. Other Payout Events
- `payout_initiated` - Payout started
- `payout_processing` - Payout in progress (hidden by default)
- `payout_retry_scheduled` - Retry scheduled
- `payout_cancelled` - Payout cancelled

## Criticality Levels

### Device (`device`)
- **Highest priority**
- Sends push notifications if enabled
- Used for critical account and payment issues
- Examples: Email verification, payment failures, system announcements

### Normal (`normal`)
- **Standard priority**
- Shows in notifications tab
- Used for user interactions and completed events
- Examples: New followers, page mentions, completed payouts

### Hidden (`hidden`)
- **Lowest priority**
- Can be hidden by user preference
- Used for intermediate states
- Examples: Payout processing status

## Architecture

### API Endpoints
- `GET /api/notifications` - List notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications` - Mark as read/unread
- `DELETE /api/notifications` - Delete notification

### Database Structure
```
users/{userId}/notifications/{notificationId}
{
  id: string,
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  sourceUserId?: string,
  targetPageId?: string,
  targetPageTitle?: string,
  actionUrl?: string,
  metadata?: object,
  read: boolean,
  readAt?: timestamp,
  criticality: 'device' | 'normal' | 'hidden',
  createdAt: timestamp
}
```

### Notification Creation

#### Automatic Triggers
1. **Page Links**: Created in `updateBacklinksIndex()` when pages link to other pages
2. **Payment Events**: Created via Stripe webhooks
3. **Payout Events**: Created by payout processing system
4. **Email Verification**: Created by authentication system

#### Manual Creation
```typescript
import { createNotification } from '../services/notificationsApi';

await createNotification({
  userId: 'target-user-id',
  type: 'link',
  title: 'Page Mention',
  message: 'Someone linked to your page',
  sourceUserId: 'source-user-id',
  targetPageId: 'page-id',
  targetPageTitle: 'Page Title',
  metadata: { category: 'engagement' }
});
```

## User Interface

### Notification Bell
- Shows unread count badge
- Click to open notifications dropdown
- Real-time updates via optimized polling

### Notification List
- Chronological order (newest first)
- Visual distinction for read/unread
- Click to mark as read and navigate to action URL
- Bulk "mark all as read" functionality

### Settings
- Per-type notification preferences
- Push notification toggles
- In-app notification controls
- Located at `/settings/notifications`

## Removed Features

The following notification types have been **removed** as they reference non-existent functionality:

- ❌ `like` - Page likes don't exist
- ❌ `comment` - Comments don't exist  
- ❌ `page_mention` - Replaced with `link`
- ❌ `page_follow` - Page following doesn't exist

## Implementation Notes

### Performance Optimizations
- Notifications use subcollection structure for scalability
- Unread counts are cached on user documents
- Optimized polling reduces database reads by 90%

### Security Considerations
- All notifications are user-scoped (no cross-user access)
- Source user validation prevents spoofing
- Rate limiting prevents notification spam

### Testing
- Test notifications available via `createTestNotification()`
- Email verification notifications can be force-created for testing
- Comprehensive notification preferences testing in settings

## Migration Notes

When updating existing code:
1. Remove references to `like`, `comment`, and `page_follow` notifications
2. Update `follow` notifications to reference users, not pages
3. Use `link` type for page mentions instead of `page_mention`
4. Ensure all notification creation goes through the API service
