# Development Authentication Guide

## Overview

The development authentication system provides isolated test users that prevent mixing test data with production accounts. This ensures safe development and testing without affecting real user data.

## Test Users

### Available Test Users

| User | Email | Username | Role | Purpose |
|------|-------|----------|------|---------|
| **Test User 1** | test1@wewrite.dev | testuser1 | Regular User | Primary testing account |
| **Test User 2** | test2@wewrite.dev | testuser2 | Regular User | Secondary user for interactions |
| **Test Admin** | admin@wewrite.dev | testadmin | Admin | Testing admin features |
| **Test Writer** | writer@wewrite.dev | testwriter | Writer | Testing content creation |
| **Test Reader** | reader@wewrite.dev | testreader | Reader | Testing consumption features |

**Password for all test users:** `testpass123`

### User Roles & Use Cases

#### Test User 1 (Primary)
- **Use for:** Main development and testing
- **Features:** Full user functionality
- **Data:** Can have pages, subscriptions, tokens

#### Test User 2 (Secondary)
- **Use for:** Testing user interactions
- **Features:** Following, collaboration, comments
- **Data:** Separate from Test User 1

#### Test Admin
- **Use for:** Admin panel testing
- **Features:** Admin dashboard, user management
- **Permissions:** Full admin access

#### Test Writer
- **Use for:** Content creation workflows
- **Features:** Page creation, editing, publishing
- **Focus:** Writing and publishing features

#### Test Reader
- **Use for:** Content consumption
- **Features:** Reading, following, notifications
- **Focus:** Reader experience

## Authentication Flow

### Development Mode
1. **Automatic Detection:** System detects `USE_DEV_AUTH=true` in environment
2. **Isolated Authentication:** Only predefined test users can log in
3. **Mock Firebase:** No real Firebase Auth calls
4. **Separate Data:** Uses DEV_ prefixed collections

### Login Methods
- **Email:** `test1@wewrite.dev`
- **Username:** `testuser1`
- **Password:** `testpass123`

## User Management Best Practices

### 1. **When to Use Multiple Users**
- ✅ Testing user interactions (following, collaboration)
- ✅ Testing permission systems
- ✅ Testing subscription states
- ✅ Testing admin vs regular user features
- ✅ Testing multi-user scenarios

### 2. **User Switching Strategy**
- **Quick Development:** Use Test User 1 for most work
- **Feature Testing:** Switch to appropriate role-based user
- **Integration Testing:** Use multiple users for workflows
- **Admin Testing:** Switch to Test Admin

### 3. **Data Isolation**
- Each test user has separate data
- No cross-contamination with production
- Safe to reset/clear test data
- Environment-specific collections (DEV_ prefix)

### 4. **Logout Behavior**
- ✅ **Allow logout:** Enables testing logged-out states
- ✅ **Quick switching:** Easy to switch between users
- ✅ **Session management:** Test session persistence
- ✅ **Auth flows:** Test login/logout workflows

## Development Auth Panel

### Features
- **Current User Display:** Shows who's logged in
- **Quick Sign Out:** One-click logout
- **User Switching:** Switch between test users without logout
- **User Descriptions:** Clear purpose for each test user
- **Admin Indicators:** Visual badges for admin users

### Usage
1. **Panel Location:** Appears automatically in development
2. **Expand/Collapse:** Click to show/hide user list
3. **Quick Switch:** Click any user to switch instantly
4. **Sign Out:** Red button to logout completely

## Environment Configuration

### Required Environment Variables
```bash
# .env.local
USE_DEV_AUTH=true
NODE_ENV=development
```

### Disabling Development Auth
Remove or set to false:
```bash
USE_DEV_AUTH=false
```

## Security Features

### Production Protection
- ✅ **Environment Checks:** Only works in development
- ✅ **Predefined Users:** No arbitrary user creation
- ✅ **Isolated Data:** Separate from production collections
- ✅ **Mock Authentication:** No real Firebase Auth calls

### Development Safety
- ✅ **Clear Indicators:** Visual warnings about dev mode
- ✅ **Separate Collections:** DEV_ prefixed data
- ✅ **No Production Access:** Cannot access real user data
- ✅ **Reset Safe:** Can clear all test data safely

## Testing Scenarios

### Single User Testing
- Page creation and editing
- Subscription management
- Token allocation
- Profile management

### Multi-User Testing
- User following/unfollowing
- Page collaboration
- Comment interactions
- Activity feeds

### Admin Testing
- User management
- System administration
- Analytics and reporting
- Content moderation

### Auth Flow Testing
- Login/logout cycles
- Session persistence
- Account switching
- Error handling

## Troubleshooting

### Common Issues
1. **"Development auth not enabled"**
   - Check `USE_DEV_AUTH=true` in .env.local
   - Restart development server

2. **"Invalid test user credentials"**
   - Use exact email/username from test users
   - Password is `testpass123` for all users

3. **"Session not found"**
   - Clear browser storage
   - Sign out and sign in again

### Debug Tools
- Development auth panel
- Browser console logs
- API debug endpoints
- Session storage inspection

## Best Practices Summary

1. **Use multiple test users** for comprehensive testing
2. **Allow logout** to test all auth states
3. **Switch users frequently** to test interactions
4. **Use role-specific users** for targeted testing
5. **Keep test data separate** from production
6. **Reset test data regularly** for clean testing
7. **Test auth flows** including login/logout cycles
