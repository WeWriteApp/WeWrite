# Admin Account Setup Guide

This guide explains how to set up a secure admin test account that can access production data in the admin dashboard.

## Overview

The admin dashboard should always show production data, regardless of the environment it's running in. We've created a secure admin test account system that:

- ✅ Always accesses production data (no DEV_ prefixes)
- ✅ Uses a secure password (minimum 12 characters)
- ✅ Has proper admin permissions in Firestore
- ✅ Can be used in any environment (dev, preview, production)

## Admin Accounts

The following accounts have admin access:

1. **jamiegray2234@gmail.com** - Primary admin account
2. **admin.test@wewrite.app** - Secure test admin account (to be created)

## Setup Steps

### 1. Enable Admin Account Creation

Add this environment variable to enable the account creation endpoint:

```bash
# .env.local
ENABLE_ADMIN_ACCOUNT_CREATION=true
```

### 2. Create the Admin Account

1. **Log in as an existing admin** (jamiegray2234@gmail.com)

2. **Generate a secure password** (minimum 12 characters):
   ```
   Suggested format: AdminTest2024!SecurePass
   ```

3. **Call the creation endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/create-admin-account \
     -H "Content-Type: application/json" \
     -d '{"password": "YourSecurePassword123!"}'
   ```

   Or use the browser:
   - Go to `/api/admin/create-admin-account` (POST request)
   - Include the password in the request body

### 3. Verify the Account

Check if the account was created successfully:

```bash
curl http://localhost:3000/api/admin/create-admin-account
```

### 4. Test the Account

1. **Log out** of your current admin account
2. **Log in** with the new admin account:
   - Email: `admin.test@wewrite.app`
   - Password: `[your secure password]`
3. **Access the admin dashboard** and verify you can see production data

### 5. Disable Account Creation (Security)

Once the account is created, disable the creation endpoint:

```bash
# Remove or comment out this line in .env.local
# ENABLE_ADMIN_ACCOUNT_CREATION=true
```

## Data Access Behavior

The admin account will always see **production data**, regardless of environment:

| Environment | Regular Users See | Admin Users See |
|-------------|------------------|-----------------|
| Development | `DEV_pages`, `DEV_users`, etc. | `pages`, `users`, etc. (production) |
| Preview | `pages`, `users`, etc. (production) | `pages`, `users`, etc. (production) |
| Production | `pages`, `users`, etc. (production) | `pages`, `users`, etc. (production) |

## Admin Dashboard Features

With the admin account, you can access:

- 📊 **Analytics Dashboard** - Real production metrics
- 👥 **User Management** - Production user data
- 💰 **Payment Analytics** - Real subscription and payment data
- 🔧 **System Health** - Production system status
- 📈 **Token Analytics** - Real token allocation data

## Security Notes

1. **Store the password securely** - Use a password manager
2. **Disable account creation** after setup
3. **Monitor admin access** - Check Firebase Auth logs
4. **Use strong passwords** - Minimum 12 characters with mixed case, numbers, and symbols
5. **Limit admin access** - Only add trusted users to the admin list

## Troubleshooting

### Account Creation Fails

1. **Check environment variable**: Ensure `ENABLE_ADMIN_ACCOUNT_CREATION=true`
2. **Check admin permissions**: Must be logged in as existing admin
3. **Check password strength**: Minimum 12 characters required
4. **Check Firebase Admin SDK**: Ensure proper Firebase configuration

### Can't Access Admin Dashboard

1. **Verify email**: Must be exactly `admin.test@wewrite.app`
2. **Check Firestore rules**: Ensure admin rules are deployed
3. **Clear browser cache**: Hard refresh the admin dashboard
4. **Check console errors**: Look for permission or authentication errors

### Not Seeing Production Data

1. **Check AdminDataService**: Should use `getProductionCollectionName()`
2. **Verify Firestore rules**: Admin rules should allow access to base collections
3. **Check environment detection**: Admin should bypass environment prefixes

## API Endpoints

- `POST /api/admin/create-admin-account` - Create/update admin account
- `GET /api/admin/create-admin-account` - Check if admin account exists
- `GET /api/admin/debug-environment` - Debug environment configuration
- `GET /api/admin/verify-dashboard` - Test all admin data pipelines

## Next Steps

After setting up the admin account:

1. **Test all admin features** to ensure they work with production data
2. **Document the password** in your secure password manager
3. **Remove the creation endpoint** from production deployments
4. **Monitor admin dashboard performance** with real production data
5. **Set up monitoring alerts** for admin dashboard health

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check the server logs for authentication issues
3. Verify Firestore security rules are properly deployed
4. Test the verification endpoints to diagnose specific issues
