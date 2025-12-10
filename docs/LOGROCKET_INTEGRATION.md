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
- **Production Domains**: Only runs on `getwewrite.app`, `www.getwewrite.app`, `wewrite.app`, or `www.wewrite.app`
- **Client-Side Only**: Never runs on server
- **Localhost Ignored**: Skips localhost and .local domains

### Data Protection & Redaction Strategy

WeWrite uses a **selective redaction approach** since most content is public:

#### ✅ **Not Redacted (Visible in LogRocket)**
- Page content and text (since WeWrite pages are public)
- Page titles and descriptions
- User interface text and labels
- Navigation and menu interactions
- General form inputs (page creation, editing)
- Search queries and results
- Public user profiles and usernames

#### 🔒 **Redacted (Hidden in LogRocket)**
- **Payment Information**: Credit card numbers, CVV, expiration dates
- **Bank Account Details**: Account numbers, routing numbers, IBAN, SWIFT codes
- **Payout Information**: Withdrawal amounts, transfer details, bank connections
- **Authentication Data**: Passwords, PINs, API tokens, secrets
- **Personal Financial IDs**: SSN, tax IDs, EIN numbers
- **Stripe/Plaid Forms**: Any input within payment or bank connection flows

#### 🤖 **Smart Detection**
The system automatically detects sensitive elements by:
- Element IDs, names, classes, and types
- Placeholder text and aria-labels
- Parent container context (payment forms, bank modals)
- Common financial keywords and patterns

#### 📋 **Implementation Details**
- **Input Sanitizer**: Custom function that checks each input element
- **Context Aware**: Examines parent containers up to 3 levels
- **Pattern Matching**: Uses comprehensive financial keyword detection
- **Text Sanitizer**: Disabled for general content since pages are public

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
   - Verify `NEXT_PUBLIC_LOGROCKET_APP_ID` is set in Vercel environment variables
   - Ensure you're on a production domain (`getwewrite.app` or `www.getwewrite.app`)
   - Check browser console for errors (look for "LogRocket skipped" messages)

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

// Test redaction logic (development only)
import { testRedactionLogic } from '../utils/logrocket';
testRedactionLogic(); // Shows which elements would be redacted
```

### Testing Redaction Logic

To verify that the selective redaction is working correctly:

```typescript
import { testRedactionLogic } from '../utils/logrocket';

// Run in browser console to test redaction patterns
testRedactionLogic();
```

This will output:
- ✅ Elements that should be redacted (financial inputs)
- ❌ Elements that should NOT be redacted (public content)

### Redaction Examples

**Will be redacted:**
```html
<input id="card-number" name="cardNumber" type="text" />
<input id="cvv" name="cvv" type="password" />
<input id="bank-account" name="accountNumber" />
<input class="stripe-input" name="payment" />
<div class="payment-form">
  <input name="amount" /> <!-- Redacted due to parent context -->
</div>
```

**Will NOT be redacted:**
```html
<input id="page-title" name="title" type="text" />
<textarea id="page-content" name="content"></textarea>
<input id="username" name="username" type="text" />
<input id="search-query" name="search" type="text" />
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
