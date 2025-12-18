# Banner System Guide

## Overview

WeWrite uses a unified banner system to show important notifications to users at the top of the application. The system prioritizes banners to ensure users only see one thing at a time, preventing cognitive overload.

> **Related Documentation**:
> - [Header System](./HEADER_SYSTEM.md) - Header components that banners appear below
> - [Settings Navigation System](./SETTINGS_NAVIGATION_SYSTEM.md) - Settings page patterns

## Banner Priority System

### **Priority Order (Highest to Lowest)**

1. **Save Banner** - Shows when user has unsaved changes (sticky at top)
2. **Email Verification Banner** - Shows when user's email is not verified
3. **Username Setup Banner** - Shows when user has a temporary `user_*` username
4. **PWA Installation Banner** - Shows when user can install WeWrite as an app

### **"One Thing at a Time" Rule**

- Only **ONE** banner is shown at any given time
- Higher priority banners **always** take precedence
- Lower priority banners are **hidden** until higher priority ones are dismissed
- This prevents banner stacking and reduces user confusion

## Current Banner Types

### 1. Email Verification Banner

**Purpose**: Prompt users to verify their email address
**Priority**: Highest (1)
**Component**: `app/components/utils/VerifyEmailBanner.tsx`

**Behavior**:
- Shows only when `user.emailVerified === false`
- Matches PWA banner design exactly
- Two action buttons: "Later", "How?"
- "How?" button opens help modal with verification steps
- "Later" = 24-hour dismissal (localStorage)
- Help modal includes:
  - Troubleshooting steps (check spam, verify email address)
  - "Check Email in Settings" button
  - "Send Again" button with progressive cooldown (10s → 60s → 2min → 5min)

**Admin Control**:
- **Admin Switch**: "Show unverified email banner" toggle in `/admin`
- **Testing Override**: When enabled, banner shows for ALL users (even verified ones)
- **Persistent**: Setting persists across browser sessions
- **Usage**: Toggle switch in admin → Navigate to main app → See banner immediately

### 2. Username Setup Banner

**Purpose**: Prompt users to set a permanent username
**Priority**: Medium (3)
**Component**: `app/components/utils/UsernameSetupBanner.tsx`

**Behavior**:
- Shows only when user has temporary `user_*` username
- Shows only when Email Verification Banner is NOT showing
- "Later" = 24-hour dismissal
- "Don't remind me" = permanent dismissal

### 3. PWA Installation Banner

**Purpose**: Encourage users to install WeWrite as a Progressive Web App
**Priority**: Lower (4)
**Component**: `app/components/utils/PWABanner.tsx`

**Behavior**:
- Shows only when higher priority banners are NOT showing
- Only appears on mobile devices
- Only shows when not already running as PWA
- Three action buttons: "Never", "Later", "Yes!"
- "Yes!" opens installation instructions modal

### 4. Save Banner (Special)

**Purpose**: Indicate unsaved changes during editing
**Priority**: Highest (1) - appears above all content
**Component**: `app/components/editor/StickySaveHeader.tsx`

**Behavior**:
- Shows only when editing content with unsaved changes
- Sticky at top of viewport
- Contains "Revert" and "Save" buttons
- Managed separately via `setSaveBannerVisible` in BannerProvider

## Technical Implementation

### Banner Provider System

**File**: `app/providers/BannerProvider.tsx`

The `BannerProvider` manages banner visibility and priority:

```tsx
const {
  showEmailBanner,
  showUsernameBanner,
  showPWABanner,
  showSaveBanner,
  bannerOffset,
  setSaveBannerVisible
} = useBanner();
```

**Key Logic**:
- **Admin Override**: Checks `localStorage.getItem('wewrite_admin_email_banner_override')` first
- **Email Verification**: Shows if user is unverified and hasn't dismissed
- **PWA Priority**: Shows ONLY if email banner is NOT showing
- **Automatic Management**: Priority system ensures one-at-a-time display

**Admin Override Implementation**:
```tsx
// BannerProvider checks admin override first
const shouldShowEmailBanner = () => {
  // Admin testing override takes precedence
  const adminOverride = localStorage.getItem('wewrite_admin_email_banner_override');
  if (adminOverride === 'true') return true;

  // Normal logic for unverified users
  if (user.emailVerified) return false;
  // ... other checks
};
```

### Banner Rendering

**Location**: `app/components/layout/GlobalNavigation.tsx`

```tsx
{/* Banner system - shows at top of content */}
<VerifyEmailBanner />
<PWABanner />
```

**Important**: Banners are rendered in GlobalNavigation for authenticated users only.

## Design Standards

### Visual Consistency

All banners must follow the same design pattern:

```tsx
<div className="relative mx-4 mb-4 md:hidden">
  <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 flex flex-col transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-sm">
    {/* Icon + Message */}
    <div className="flex items-center space-x-2 mb-2">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">Message</span>
    </div>
    
    {/* Three Action Buttons */}
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" size="sm" className="h-9 text-xs text-foreground">
        Never
      </Button>
      <Button variant="outline" size="sm" className="h-9 text-xs text-foreground">
        Later
      </Button>
      <Button variant="default" size="sm" className="h-9 text-xs">
        Action
      </Button>
    </div>
  </div>
</div>
```

### Animation Standards

- **Collapse Animation**: 300ms duration with scale and translate effects
- **Smooth Transitions**: All state changes use CSS transitions
- **Consistent Timing**: All banners use identical animation timing

### Mobile-First Design

- Banners only show on mobile (`md:hidden`)
- Responsive button sizing and text
- Touch-friendly button targets (minimum 44px)

## Adding New Banners

### Step 1: Create Banner Component

Follow the established pattern in `VerifyEmailBanner.tsx`:

1. Use the standard visual design
2. Implement collapse animations
3. Add analytics tracking
4. Handle dismissal states with localStorage

### Step 2: Update Banner Provider

Add new banner logic to `BannerProvider.tsx`:

1. Add state management for new banner
2. Implement priority logic (higher priority = lower number)
3. Update context interface

### Step 3: Update Priority Documentation

Update this guide with:
- New banner's priority level
- Purpose and behavior
- Admin controls (if any)

### Step 4: Add Analytics Events

Add appropriate events to `app/constants/analytics-events.ts`:

```tsx
export const NEW_BANNER_EVENTS = {
  BANNER_ACTION: 'new_banner_action',
  // ... other events
};

export const EVENT_CATEGORIES = {
  // ... existing categories
  NEW_BANNER: 'New_Banner'
};
```

## Admin Controls & Testing

### Email Verification Banner

- **Admin Switch**: "Show unverified email banner" toggle in `/admin`
- **Testing Override**: Forces banner to show for ALL users (even verified)
- **Persistent**: Setting saved in localStorage across sessions
- **Testing Flow**:
  1. Go to `/admin`
  2. Toggle "Show unverified email banner" → ON
  3. Navigate to any main app page
  4. Banner appears immediately at top of page
  5. Toggle OFF to hide banner

### PWA Banner

- **Control**: Automatic based on device capabilities and email verification status
- **No Admin Override**: Always shows when conditions are met (mobile + not PWA + email verified)

### Design System Integration

- **Visual Reference**: View banner styling in `/admin/design-system`
- **Component Showcase**: Static examples of both banner types
- **Design Documentation**: Technical implementation details and CSS classes
- **Card System**: Banners use identical styling to the universal card system

## Best Practices

### For Developers

1. **Never Stack Banners**: Always use the priority system
2. **Consistent Design**: Follow the established visual pattern
3. **Mobile-First**: Banners are mobile-only by design
4. **Analytics**: Track all user interactions
5. **Dismissal Respect**: Honor user dismissal preferences

### For Product/Design

1. **One Thing at a Time**: Never show multiple banners simultaneously
2. **Clear Actions**: Always provide clear, actionable buttons
3. **Respectful Dismissal**: "Never" means never - respect user choice
4. **Progressive Disclosure**: Higher priority items first

### For Content

1. **Concise Messaging**: Keep banner text short and clear
2. **Action-Oriented**: Focus on what user should do
3. **Benefit-Focused**: Explain why the action matters
4. **Help-First Approach**: Provide help before asking for action

## Future Considerations

### Potential New Banners

When adding new banners, consider priority order:

1. **Security/Critical** (Email verification, account security)
2. **Feature Adoption** (PWA installation, new features)
3. **Engagement** (Tips, tutorials, promotions)

### Scalability

The current system supports unlimited banners through the priority system. New banners simply need:
- Priority number assignment
- Provider integration
- Component creation

---

## Quick Reference

**Key Files**:
- `app/providers/BannerProvider.tsx` - Priority management
- `app/components/utils/VerifyEmailBanner.tsx` - Email verification
- `app/components/utils/UsernameSetupBanner.tsx` - Username setup
- `app/components/utils/PWABanner.tsx` - PWA installation
- `app/components/editor/StickySaveHeader.tsx` - Save/revert banner
- `app/components/layout/GlobalNavigation.tsx` - Rendering location

**Key Principle**: **One banner at a time, highest priority wins**

## PWA Dismissal Bug Investigation

### **Historical Issue**
Users reported being unable to dismiss the email verification banner in PWA mode, while it worked fine in browsers and on desktop.

### **Root Cause Analysis**
The issue was likely related to:
1. **Touch Event Handling**: PWA apps handle touch events differently than browsers
2. **Event Propagation**: Touch events might not propagate correctly in PWA context
3. **Button Touch Targets**: Insufficient touch target sizes for PWA interaction

### **Resolution**
The new unified banner system addresses these issues through:
1. **Consistent Event Handling**: Both banners use identical touch event patterns
2. **Proper Touch Targets**: All buttons meet 44px minimum touch target requirements
3. **Event Delegation**: Improved event handling that works across PWA and browser contexts
4. **Progressive Enhancement**: Touch events work as fallbacks to click events

### **Testing Recommendations**
- Test banner dismissal in both browser and PWA modes
- Verify touch targets are accessible on various mobile devices
- Confirm event handling works with different PWA installation methods

## Quick Testing Guide

### For Developers
1. **View Design**: Go to `/admin/design-system` → Scroll to "Banner System"
2. **Test Functionality**:
   - Go to `/admin`
   - Toggle "Show unverified email banner" → ON
   - Navigate to `/` or any main page
   - Banner appears at top
3. **Test Priority**: Email banner hides PWA banner when both should show
4. **Reset**: Toggle admin switch OFF to return to normal behavior

### For QA/Testing
- **Admin Override**: Forces banner for ALL users (ignores email verification status)
- **Persistent**: Setting survives page refreshes and browser sessions
- **Mobile Only**: Banners only appear on mobile devices (`md:hidden`)
- **Priority Order**: Email verification → PWA installation
- **Dismissal**: "Never" = permanent, "Later" = 24 hours
