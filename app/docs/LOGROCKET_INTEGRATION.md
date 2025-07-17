# LogRocket Integration for WeWrite

## Overview

LogRocket has been integrated into WeWrite to provide comprehensive session replay, console logging, and error tracking. The integration follows Next.js best practices and includes robust data sanitization to protect sensitive user information.

## Features

### 🎥 Session Replay
- **Production Only**: LogRocket only initializes in production environment
- **Client-Side Only**: No SSR issues, runs only in browser
- **Bot Detection**: Automatically ignores bot traffic and crawlers
- **Localhost Filtering**: Ignores localhost and development domains

### 🔒 Data Sanitization
- **Sensitive Data Protection**: Automatically redacts token balances, payment info, auth tokens
- **Email Masking**: Shows domain but masks user part (e.g., `ja***@example.com`)
- **Amount Ranges**: Token amounts converted to ranges instead of exact values
- **DOM Sanitization**: Removes sensitive form fields and elements

### 📊 Event Tracking
- **Drag & Drop**: Link rearrangement tracking
- **Token Allocation**: User token allocation behavior
- **Modal Interactions**: Modal open/close/submit events
- **Payout Flows**: Payment and payout process tracking
- **Page Creation**: New page creation events
- **Page Editing**: Save, auto-save, undo/redo actions

## Configuration

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_LOGROCKET_APP_ID=uviabq/wewrite
```

### Initialization

LogRocket initializes automatically in production via the `LogRocketProvider` in the app layout.

## Architecture

### Core Components

1. **`app/utils/logrocket.ts`** - Main LogRocket service with sanitization
2. **`app/providers/LogRocketProvider.tsx`** - React context provider
3. **`app/layout.tsx`** - Provider integration

### Data Flow

```
User Action → Component → LogRocket Hook → Sanitization → LogRocket API
```

## Usage Examples

### Basic Event Tracking

```typescript
import { useLogRocket } from '../providers/LogRocketProvider';

function MyComponent() {
  const { track } = useLogRocket();
  
  const handleClick = () => {
    track('button_click', {
      buttonType: 'save',
      pageId: 'current_page'
    });
  };
}
```

### Drag & Drop Tracking

```typescript
const { trackDragDropLink } = useLogRocket();

// Start drag
trackDragDropLink({
  action: 'start',
  linkId: 'link_123',
  fromPosition: 2,
  pageId: 'page_456'
});

// Drop complete
trackDragDropLink({
  action: 'drop',
  linkId: 'link_123',
  fromPosition: 2,
  toPosition: 5,
  pageId: 'page_456'
});
```

### Token Allocation Tracking

```typescript
const { trackTokenAllocation } = useLogRocket();

trackTokenAllocation({
  action: 'allocate',
  amount: 10, // Will be sanitized to range
  pageId: 'page_123',
  totalBalance: 100 // Will be sanitized to range
});
```

### Modal Interaction Tracking

```typescript
const { trackModalInteraction } = useLogRocket();

// Modal opened
trackModalInteraction({
  modalType: 'token_allocation',
  action: 'open',
  source: 'pledge_bar'
});
```

### Payout Flow Tracking

```typescript
const { trackPayoutFlow } = useLogRocket();

trackPayoutFlow({
  step: 'start',
  payoutAmount: 50.00 // Will be sanitized to range
});
```

## Data Sanitization

### Sensitive Data Patterns

The following data is automatically sanitized:

- **Token Balances**: Converted to ranges (1-10, 11-50, 51-100, etc.)
- **Payment Amounts**: Converted to ranges
- **Email Addresses**: Masked (ja***@example.com)
- **Auth Tokens**: Completely redacted
- **API Keys**: Completely redacted
- **Payment Methods**: Completely redacted

### DOM Element Sanitization

```css
/* Automatically sanitized elements */
input[type="password"]
input[name*="token"]
input[name*="key"]
.token-balance
.auth-token
.payment-info
.stripe-element
```

### Network Request Sanitization

Sensitive headers and request bodies are automatically filtered.

## User Identification

Users are automatically identified when they log in:

```typescript
// Automatically called on login
identifyUser({
  id: user.uid,
  username: user.username,
  email: user.email, // Will be sanitized
  accountType: 'user',
  createdAt: user.createdAt
});
```

## Event Types

### Tracked Events

1. **`user_session_start`** - User logs in
2. **`drag_drop_link`** - Link drag and drop operations
3. **`token_allocation`** - Token allocation changes
4. **`modal_interaction`** - Modal open/close/submit
5. **`payout_flow`** - Payout process steps
6. **`page_creation`** - New page creation
7. **`page_edit`** - Page editing actions

### Event Properties

All events include:
- `timestamp` - ISO timestamp
- `userId` - Sanitized user ID
- Action-specific properties (sanitized)

## Security Features

### Bot Detection

```typescript
// Automatically detects and ignores
const botPatterns = [
  'bot', 'crawler', 'spider', 'scraper', 
  'headless', 'phantom', 'selenium', 
  'puppeteer', 'playwright'
];
```

### Environment Filtering

- **Production Only**: Only runs in `NODE_ENV === 'production'`
- **Client-Side Only**: Never runs on server
- **Localhost Ignored**: Skips localhost and .local domains

### Data Protection

- **No PII**: Personal identifiable information is sanitized
- **No Financial Data**: Exact amounts are converted to ranges
- **No Auth Data**: Tokens and keys are redacted
- **GDPR Compliant**: Minimal data collection with user consent

## Debugging

### Session URL Access

```typescript
const { getSessionURL } = useLogRocket();

getSessionURL((url) => {
  console.log('LogRocket session:', url);
  // Share with support team for debugging
});
```

### Development Mode

LogRocket is disabled in development. To test:

1. Set `NODE_ENV=production` locally
2. Use staging environment
3. Check browser console for LogRocket logs

## Integration Points

### Components with LogRocket Tracking

1. **Editor.tsx** - Drag & drop link tracking
2. **TokenAllocationModal.tsx** - Token allocation tracking
3. **PayoutDashboard.tsx** - Payout flow tracking
4. **NewPage.tsx** - Page creation tracking
5. **CurrentAccountProvider.tsx** - User identification

### Automatic Tracking

- User login/logout
- Session start/end
- Error boundaries
- Navigation events (via Next.js)

## Best Practices

### Do's ✅

- Use provided hooks for tracking
- Track user actions, not system events
- Include relevant context in events
- Use descriptive event names

### Don'ts ❌

- Don't track sensitive data directly
- Don't track every minor interaction
- Don't include PII in event properties
- Don't track server-side events

## Troubleshooting

### Common Issues

1. **LogRocket not initializing**
   - Check `NODE_ENV === 'production'`
   - Verify `NEXT_PUBLIC_LOGROCKET_APP_ID` is set
   - Check browser console for errors

2. **Events not appearing**
   - Ensure using production environment
   - Check network tab for LogRocket requests
   - Verify event data is not being sanitized away

3. **Session not recording**
   - Check for bot detection false positives
   - Verify not on localhost
   - Check LogRocket dashboard for session

### Debug Commands

```typescript
// Check if LogRocket is ready
console.log('LogRocket ready:', logRocketService.isReady);

// Get current session URL
getSessionURL(url => console.log('Session:', url));

// Test event tracking
track('test_event', { test: true });
```

## Support

For LogRocket-related issues:

1. Check browser console for LogRocket logs
2. Verify environment configuration
3. Test in production environment
4. Contact LogRocket support with session URL

## Future Enhancements

- [ ] Custom dashboard for WeWrite metrics
- [ ] Integration with error reporting
- [ ] Advanced user segmentation
- [ ] Performance monitoring integration
- [ ] A/B testing integration
