# Authentication Guide

## Overview

WeWrite uses a clean Firebase authentication system. The complex development auth wrapper has been removed in favor of standard Firebase Auth for better maintainability and reliability.

## ✅ Recent Updates

**Payment Feature Flags Removed** (2025-01-24): All payment functionality is now always available to authenticated users. No feature flags control payment access.

**Authentication Simplified** (Ongoing): Continued removal of complex auth patterns in favor of simple Firebase Auth.

## Authentication System

### Firebase Auth
- **Provider:** Firebase Authentication
- **Features:** Email/password, user registration, password reset
- **Environment:** Uses standard Firebase project configuration
- **Session Management:** Firebase Auth tokens with session cookies

### Test Users (Development)

Pre-configured test accounts are available in development mode (defined in `/app/utils/testUsers.ts`):

| Email | Username | Password | Admin | Purpose |
|-------|----------|----------|-------|---------|
| **jamie@wewrite.app** | jamie | TestPassword123! | ✅ Yes | Admin testing |
| **test@wewrite.app** | testuser | TestPassword123! | ❌ No | Regular user testing |
| **getwewrite@gmail.com** | getwewrite | TestPassword123! | ❌ No | Official WeWrite account |

**Note:** These accounts are automatically available when `USE_DEV_AUTH=true` in development.

### Admin Access

Admin functionality is available to:
- **Email:** `jamiegray2234@gmail.com` (hardcoded admin)
- **Features:** Admin dashboard, user management, analytics
- **Access:** Automatic based on email address

## Authentication Flow

### Firebase Auth Flow
1. **Registration:** Users register with email/password through `/auth/register`
2. **Login:** Users login with email/username and password through `/auth/login`
3. **Session:** Firebase Auth token is used for authentication
4. **Logout:** Standard Firebase signOut through `/auth/logout`

### Login Methods
- **Email:** Any valid email address
- **Username:** Username lookup via Firestore
- **Password:** User-defined password

## Development Best Practices

### 1. **Testing with Multiple Users**
- Create separate test accounts for different scenarios
- Use different browsers/incognito for multi-user testing
- Test user interactions (following, collaboration)
- Test permission systems and admin features

### 2. **Environment Configuration**
- **Development:** Uses development Firebase project
- **Production:** Uses production Firebase project
- **Collections:** Environment-aware collection names
- **Data Isolation:** Separate data per environment

### 3. **Session Management**
- Firebase Auth handles session persistence
- Simple session cookies for middleware compatibility
- Automatic token refresh
- Clean logout clears all session data

### 4. **Admin Access**
- Admin features available to `jamiegray2234@gmail.com`
- Admin status checked on each request
- No special admin registration required
## Environment Configuration

### Firebase Configuration
```bash
# .env.local
NEXT_PUBLIC_FIREBASE_PID=your-project-id
NEXT_PUBLIC_FIREBASE_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
# ... other Firebase config
```

### Environment Types
- **Development:** Uses development Firebase project
- **Production:** Uses production Firebase project
- **Collections:** Environment-aware collection names (DEV_ prefix in dev)

## Security Features

### Production Protection
- ✅ **Environment Separation:** Dev and prod use different Firebase projects
- ✅ **Collection Isolation:** DEV_ prefixed collections in development
- ✅ **Admin Controls:** Admin access restricted to specific email
- ✅ **Standard Firebase Security:** Uses Firebase Auth security rules

### Development Safety
- ✅ **Separate Data:** Development data isolated from production
- ✅ **Test Accounts:** Safe to create and delete test accounts
- ✅ **Reset Safe:** Can clear development data without affecting production

## Testing Scenarios

### Single User Testing
- Account registration and login
- Page creation and editing
- Subscription management
- Profile management

### Multi-User Testing
- Create multiple test accounts
- Test user interactions (following, collaboration)
- Test different permission levels
- Test admin vs regular user features

### Auth Flow Testing
- Registration flow
- Login/logout cycles
- Password reset
- Session persistence
- Error handling

## Troubleshooting

### Common Issues
1. **"Authentication failed"**
   - Check Firebase configuration
   - Verify email/password combination
   - Check browser console for errors

2. **"User not found"**
   - Ensure user is registered
   - Check username spelling
   - Try using email instead of username

3. **"Session expired"**
   - Refresh the page
   - Sign out and sign in again
   - Clear browser storage if needed

### Debug Tools
- Browser console logs
- Firebase Auth console
- Network tab for API calls
- Simple auth test page at `/simple-auth-test`

## Best Practices Summary

1. **Use separate test accounts** for different testing scenarios
2. **Test auth flows regularly** including registration and password reset
3. **Use environment-specific data** to avoid production contamination
4. **Clear test data regularly** for clean testing environments
5. **Test admin features** with the designated admin account
6. **Monitor Firebase Auth console** for user management
