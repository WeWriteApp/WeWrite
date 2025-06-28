# WeWrite Settings Navigation System

## Overview

The WeWrite settings page has been reorganized from a single, cluttered page into a clean navigation system where each section has its own dedicated page. This improves user experience by reducing cognitive load and providing focused interfaces for each settings category.

## New Structure

### Main Settings Page (`/settings`)
- **Navigation Hub**: Clean grid of cards for each settings section
- **Feature Flag Aware**: Only shows payment-related sections when enabled
- **Quick Overview**: Account summary with username, email, and status
- **Responsive Design**: 2-column grid on desktop, single column on mobile

### Individual Settings Pages

#### 1. Profile Settings (`/settings/profile`)
- **Personal Information**: Username and email management
- **Inline Editing**: Edit fields directly with save/cancel actions
- **Email Verification**: Shows verification status and actions
- **Account Actions**: Logout functionality with multi-account support

#### 2. Subscription (`/settings/subscription`)
- **Existing Page**: Already implemented subscription management
- **Payment Methods**: Credit card management
- **Active Pledges**: View and modify token allocations
- **Billing History**: Transaction history and invoices

#### 3. Earnings & Payouts (`/settings/earnings`)
- **Combined Interface**: Writer earnings and creator payouts in one place
- **Tabbed Layout**: Separate tabs for different earning types
- **Token Earnings**: Track tokens received from supporters
- **Payout Management**: Request payouts and view history
- **Real-time Updates**: Live balance and earnings tracking

#### 4. Advanced Settings (`/settings/advanced`)
- **Data Management**: Recently deleted pages with recovery options
- **Sync Settings**: Offline sync queue management
- **App Installation**: PWA installation prompts and status

## Implementation Details

### Navigation Cards
Each settings section is represented by an interactive card with:
- **Icon**: Visual identifier for the section
- **Title**: Clear section name
- **Description**: Brief explanation of what's included
- **Hover Effects**: Scale and color transitions
- **Accessibility**: Proper keyboard navigation and screen reader support

### Feature Flag Integration
```typescript
const paymentsEnabled = useFeatureFlag('payments', user?.email);

const settingsSections = [
  // Always visible sections
  { id: 'profile', title: 'Profile', ... },
  { id: 'advanced', title: 'Advanced', ... },
  
  // Payment-gated sections
  { 
    id: 'subscription', 
    title: 'Subscription', 
    requiresPayments: true,
    ...
  },
  { 
    id: 'earnings', 
    title: 'Earnings & Payouts', 
    requiresPayments: true,
    ...
  }
];

// Filter based on feature flags
const availableSections = settingsSections.filter(section => {
  if (section.requiresPayments && !paymentsEnabled) {
    return false;
  }
  return true;
});
```

### Consistent Layout Pattern
All settings pages follow the same layout structure:
```typescript
<div className="min-h-screen bg-background">
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Header with back button */}
    <div className="flex items-center mb-8">
      <Button onClick={() => router.push('/settings')}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div>
        <h1>Page Title</h1>
        <p>Page description</p>
      </div>
    </div>
    
    {/* Page content */}
    <div className="space-y-8">
      {/* Content sections */}
    </div>
  </div>
</div>
```

## Benefits

### 🎯 **Improved User Experience**
- **Focused Interfaces**: Each page has a single, clear purpose
- **Reduced Cognitive Load**: Users see only relevant settings
- **Better Navigation**: Clear visual hierarchy and breadcrumbs
- **Mobile Friendly**: Optimized for smaller screens

### 🧹 **Cleaner Codebase**
- **Separation of Concerns**: Each page handles one settings area
- **Maintainable**: Easier to update individual sections
- **Testable**: Isolated components for better testing
- **Reusable**: Common patterns across all settings pages

### 🔧 **Developer Benefits**
- **Modular Architecture**: Easy to add new settings sections
- **Feature Flag Ready**: Simple to gate features behind flags
- **Consistent Patterns**: Standardized layout and navigation
- **Type Safety**: Well-defined interfaces for settings sections

### 📱 **Responsive Design**
- **Mobile First**: Optimized for touch interfaces
- **Progressive Enhancement**: Works on all screen sizes
- **Accessible**: Proper ARIA labels and keyboard navigation
- **Performance**: Lazy loading of individual sections

## Migration Notes

### From Old Settings Page
The previous monolithic settings page has been split into:
- **Profile management** → `/settings/profile`
- **Payment sections** → `/settings/subscription` and `/settings/earnings`
- **Advanced settings** → `/settings/advanced`

### Earnings & Payouts Combination
Previously separate "Writer Earnings" and "Creator Payouts" sections are now combined into a single `/settings/earnings` page with tabbed interface:
- **Tab 1**: Writer Earnings (token-based earnings from supporters)
- **Tab 2**: Creator Payouts (traditional creator earnings and bank setup)

This combination makes sense because:
- Both relate to earning money from content
- Users often need both features
- Reduces navigation complexity
- Provides better context for different earning types

### URL Structure
```
/settings                    # Main navigation hub
├── /settings/profile        # Profile management
├── /settings/subscription   # Subscription & payment methods
├── /settings/earnings       # Combined earnings & payouts
└── /settings/account        # Account data & app settings
```

## Future Enhancements

### Potential New Sections
- **Privacy Settings**: Data export, account deletion, privacy controls
- **Notification Settings**: Email, push, and in-app notification preferences
- **Security Settings**: Two-factor auth, login history, device management
- **Integrations**: Third-party service connections and API keys

### Enhanced Navigation
- **Breadcrumb Navigation**: Show current location in settings hierarchy
- **Search Functionality**: Quick search across all settings
- **Recent Settings**: Quick access to recently modified settings
- **Settings Shortcuts**: Direct links to specific settings from other pages

### Progressive Disclosure
- **Advanced Settings**: Hide complex options behind "Advanced" toggles
- **Contextual Help**: Inline help text and tooltips
- **Guided Setup**: Step-by-step wizards for complex configurations
- **Smart Defaults**: Intelligent default values based on user behavior
