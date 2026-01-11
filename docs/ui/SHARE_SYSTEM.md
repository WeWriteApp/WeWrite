# WeWrite Share System

This document describes the centralized share functionality across the WeWrite platform.

## Overview

WeWrite uses a standardized share system that provides consistent behavior across all share actions. The system is built on the Web Share API with intelligent fallbacks for browsers that don't support it.

## Core Concepts

### Share Flow

```
User clicks Share
    ↓
Check navigator.share available?
    ├─ YES → Use native Web Share API
    │   ├─ Success → Track analytics, show success
    │   └─ Error/Cancel → Fallback to clipboard
    └─ NO → Copy to clipboard
        ├─ Modern: navigator.clipboard.writeText()
        └─ Legacy: document.execCommand('copy')
```

### Share Data Structure

All share actions include:
- **title**: Displayed in the share sheet (e.g., "My Page Title by username on WeWrite")
- **text**: Optional description/preview text
- **url**: The URL being shared

## Share Handlers

### Location: `app/utils/pageActionHandlers.ts`

### 1. `handleShare()` - Page Sharing

For sharing WeWrite pages (articles, posts, etc.).

```tsx
import { handleShare } from '@/utils/pageActionHandlers';

// Basic usage
handleShare(page, page.title, user);

// Parameters:
// - page: { id: string, title?: string, username?: string, userId?: string }
// - title: Optional override for page title
// - user: Current user for analytics tracking
```

**Generated title format**: `"{title} by {author} on WeWrite"`

### 2. `handleProfileShare()` - User Profile Sharing

For sharing user profile pages. Tab-aware to share specific views.

```tsx
import { handleProfileShare } from '@/utils/pageActionHandlers';

// Share current tab
handleProfileShare(username, currentTab, user);

// Parameters:
// - username: The profile username
// - currentTab: Current active tab ('bio', 'pages', 'graph', etc.)
// - user: Current user for analytics
```

**Generated titles**:
- Bio tab: `"username - Bio on WeWrite"`
- Pages tab: `"username - Pages on WeWrite"`
- Graph tab: `"username - Graph on WeWrite"`
- etc.

**URL format**:
- Default tab (bio): `/u/username`
- Other tabs: `/u/username?tab=graph`

### 3. `handleGenericShare()` - Custom Sharing

For sharing any URL with custom title/text.

```tsx
import { handleGenericShare } from '@/utils/pageActionHandlers';

handleGenericShare({
  url: 'https://getwewrite.app/map?lat=35&lng=-106',
  title: 'New Mexico on WeWrite Map',
  text: 'Check out this location on WeWrite',
  analyticsContext: 'map_share',
  user: currentUser
});
```

## Implementation Guidelines

### 1. Always Use Centralized Handlers

**Do:**
```tsx
import { handleShare, handleProfileShare, handleGenericShare } from '@/utils/pageActionHandlers';
```

**Don't:**
```tsx
// ❌ Don't implement share logic inline
if (navigator.share) {
  navigator.share({ url: window.location.href });
}
```

### 2. Provide Meaningful Titles

Share previews on social media and messaging apps display the title. Always provide context:

**Good titles:**
- `"My Article Title by johndoe on WeWrite"`
- `"johndoe - Graph on WeWrite"`
- `"New Mexico on WeWrite Map"`

**Bad titles:**
- `"WeWrite"` (too generic)
- `"https://getwewrite.app/abc123"` (just URL)
- No title (falls back to URL)

### 3. Include Tab/View Context in URLs

When sharing views with tabs or filters, include the state in the URL:

```tsx
// Share specific tab
const shareUrl = `/u/${username}?tab=graph`;

// Share map with coordinates
const shareUrl = `/map?lat=${lat}&lng=${lng}&zoom=${zoom}`;
```

### 4. Track Analytics

All handlers automatically track:
- `page_share_succeeded` - Successful shares
- `page_share_aborted` - Cancelled or failed shares
- Share method: `native_share`, `copy_link`, `copy_link_legacy`
- Context: `user_profile`, `page`, `map`, etc.

## Tab Display Names

For profile sharing, tabs are mapped to user-friendly names:

| Tab Value | Display Name |
|-----------|--------------|
| `bio` | Bio |
| `pages` | Pages |
| `recent-activity` | Recent Activity |
| `timeline` | Timeline |
| `graph` | Graph |
| `map` | Map |
| `external-links` | External Links |

## Components Using Share

| Component | Handler | Context |
|-----------|---------|---------|
| `ContentPageHeader` | `handleShare()` | Page sharing |
| `UserProfileHeader` | `handleProfileShare()` | Profile sharing |
| `UserGraphTab` | Custom | Graph view sharing |
| `Map page` | Custom → should migrate | Map sharing |
| `Leaderboard` | Custom → should migrate | Leaderboard sharing |

## Migration Guide

If you have inline share code, migrate to centralized handlers:

### Before:
```tsx
const handleShare = () => {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ url });
  } else {
    navigator.clipboard.writeText(url);
    toast.success('Copied!');
  }
};
```

### After:
```tsx
import { handleGenericShare } from '@/utils/pageActionHandlers';

const handleShare = () => {
  handleGenericShare({
    title: 'Meaningful Title on WeWrite',
    text: 'Optional description',
    analyticsContext: 'my_feature',
    user
  });
};
```

## Testing Share Functionality

1. **Native Share API** (mobile/supported browsers):
   - Opens native share sheet
   - Title and text should appear correctly
   - URL should be included

2. **Clipboard Fallback** (desktop/unsupported):
   - Shows "Link copied to clipboard!" toast
   - URL should be copyable

3. **Analytics**:
   - Check console for analytics events
   - Verify in admin dashboard (SharesAnalyticsWidget)

## Future Improvements

- [ ] Migrate remaining custom share implementations
- [ ] Add share preview images (Open Graph)
- [ ] Support for sharing specific content sections
- [ ] Share analytics dashboard improvements
