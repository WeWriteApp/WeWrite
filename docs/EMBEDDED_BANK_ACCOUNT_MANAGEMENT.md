# Embedded Bank Account Management

This document describes WeWrite's embedded bank account management system using Stripe Connect embedded components.

## Overview

WeWrite now uses Stripe Connect embedded components for all bank account operations, eliminating external redirects and providing a seamless in-app experience while maintaining Stripe's security standards.

## Architecture

### Components

1. **EmbeddedBankAccountSetup** - Handles new bank account setup and onboarding
2. **EmbeddedBankAccountManager** - Manages existing bank accounts and payout settings
3. **EmbeddedStripeSecurityWrapper** - Provides security validation and error handling
4. **PayoutsManager** - Updated to use embedded components instead of external redirects

### API Routes

1. **`/api/stripe/account-session`** - Creates Stripe Account Sessions for embedded components
2. **`/api/stripe/account-status`** - Retrieves account and bank account status
3. **`/api/stripe/config-check`** - Validates Stripe configuration
4. **`/api/stripe/manage-account`** - DEPRECATED (returns 410 Gone)

## Features

### ✅ Implemented Features

- **No External Redirects**: All bank account operations happen within WeWrite
- **PWA Compatible**: Works properly in Progressive Web App environments
- **Security Maintained**: Uses Stripe's secure embedded components
- **Real-time Updates**: Account status updates without page refresh
- **Error Handling**: Comprehensive error handling and user feedback
- **Environment Aware**: Uses environment-specific collections
- **API-First Architecture**: Follows established WeWrite patterns

### Bank Account Operations

1. **Account Creation**: Automatically creates Stripe Connect Express accounts
2. **Bank Account Addition**: Embedded form for adding bank accounts
3. **Micro-deposit Verification**: Handled through embedded components
4. **Account Management**: Update, view, and remove bank accounts
5. **Payout Settings**: Configure payout schedules and preferences

## Security Features

### Security Wrapper

The `EmbeddedStripeSecurityWrapper` performs the following checks:

1. **Authentication**: Verifies user is logged in
2. **Secure Context**: Ensures HTTPS connection
3. **Stripe Configuration**: Validates Stripe keys and setup
4. **Content Security Policy**: Checks for security headers
5. **User Verification**: Optional additional verification
6. **PWA Compatibility**: Ensures components work in PWA mode

### Data Protection

- No sensitive bank account data is stored in WeWrite's database
- All sensitive operations handled by Stripe's secure infrastructure
- Account IDs and metadata stored in environment-aware collections
- API routes protected with authentication middleware

## Usage

### Basic Setup

```tsx
import { EmbeddedBankAccountSetup } from '@/components/payments/EmbeddedBankAccountSetup';

function BankSetupPage() {
  const handleSuccess = () => {
    console.log('Bank account setup completed');
    // Handle success (e.g., redirect, show success message)
  };

  return (
    <EmbeddedBankAccountSetup
      onSuccess={handleSuccess}
      onCancel={() => router.back()}
      showTitle={true}
    />
  );
}
```

### Account Management

```tsx
import { EmbeddedBankAccountManager } from '@/components/payments/EmbeddedBankAccountManager';

function AccountManagementPage() {
  const handleUpdate = () => {
    console.log('Account updated');
    // Refresh account data
  };

  return (
    <EmbeddedBankAccountManager
      onUpdate={handleUpdate}
      showTitle={true}
    />
  );
}
```

## API Integration

### Creating Account Sessions

```typescript
const response = await fetch('/api/stripe/account-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    components: {
      account_onboarding: {
        enabled: true,
        features: { external_account_collection: true }
      },
      account_management: {
        enabled: true,
        features: { external_account_collection: true }
      }
    }
  })
});

const { client_secret, account_id } = await response.json();
```

### Checking Account Status

```typescript
const response = await fetch('/api/stripe/account-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: currentUser.uid })
});

const { data } = await response.json();
// data contains account details, bank account info, verification status
```

## Environment Configuration

### Required Environment Variables

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Collection Names

The system uses environment-aware collections:

- Development: `DEV_users`, `DEV_subscriptions`, etc.
- Production: `PROD_users`, `PROD_subscriptions`, etc.

## Testing

### Test Coverage

- PWA compatibility tests
- Security validation tests
- Component mounting/unmounting tests
- API integration tests
- Error handling tests

### Running Tests

```bash
npm test -- app/tests/embedded-bank-account.test.tsx
```

## Migration from External Redirects

### What Changed

1. **BankSetup Component**: Now uses `EmbeddedBankAccountSetup`
2. **Account Management**: Replaced external links with `EmbeddedBankAccountManager`
3. **API Routes**: Added new routes, deprecated old ones
4. **Security**: Enhanced with embedded security wrapper

### Deprecated Endpoints

- `/api/stripe/manage-account` - Returns 410 Gone
- `/api/create-connect-account` - Still exists but not used by embedded flow

## Troubleshooting

### Common Issues

1. **Stripe Connect Script Loading**: Ensure proper CSP headers allow Stripe domains
2. **Account Session Expiry**: Sessions expire after 1 hour, components handle refresh
3. **PWA Mode**: Some features may be limited in standalone PWA mode
4. **Network Errors**: Components gracefully handle offline scenarios

### Debug Mode

Enable debug logging:

```typescript
// In component
console.log('Stripe Connect initialized:', stripeConnect);
console.log('Account Session:', accountSession);
```

## Performance Considerations

### Optimization

1. **Lazy Loading**: Stripe Connect script loaded on demand
2. **Component Caching**: Account sessions cached for 1 hour
3. **Polling Optimization**: Status polling with exponential backoff
4. **Memory Management**: Proper cleanup of event listeners

### Monitoring

- Account session creation success rate
- Component load times
- Error rates by component type
- User completion rates

## Future Enhancements

### Planned Features

1. **Enhanced Verification**: Additional identity verification options
2. **Multi-Currency Support**: Support for international bank accounts
3. **Instant Payouts**: Integration with Stripe's instant payout features
4. **Advanced Analytics**: Detailed payout and account analytics

### Considerations

1. **Regulatory Compliance**: Ensure compliance with banking regulations
2. **International Expansion**: Support for different countries and currencies
3. **Enhanced Security**: Additional fraud prevention measures
4. **User Experience**: Continuous UX improvements based on user feedback

## Support

For issues related to embedded bank account management:

1. Check browser console for errors
2. Verify Stripe configuration
3. Test in different browsers/PWA modes
4. Review security wrapper status
5. Check API route responses

## References

- [Stripe Connect Embedded Components](https://docs.stripe.com/connect/build-full-embedded-integration)
- [Stripe Account Sessions API](https://docs.stripe.com/api/account_sessions)
- [WeWrite Environment Configuration](./environment-configuration.md)
- [WeWrite API Architecture](./api-architecture.md)
