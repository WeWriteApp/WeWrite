# WeWrite Anti-Spam & Anti-Bot Protection System

Technical documentation for WeWrite's comprehensive anti-spam and anti-bot protection system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Services](#core-services)
4. [Client-Side Components](#client-side-components)
5. [API Endpoints](#api-endpoints)
6. [Rate Limiting](#rate-limiting)
7. [Admin Integration](#admin-integration)
8. [Configuration](#configuration)
9. [File Structure](#file-structure)
10. [Integration Guide](#integration-guide)
11. [Monitoring & Debugging](#monitoring--debugging)

---

## System Overview

The anti-spam system uses a multi-layered approach combining:
- **Risk Scoring** - Weighted risk assessment from multiple signals
- **CAPTCHA Challenges** - Cloudflare Turnstile for human verification
- **Rate Limiting** - Tiered limits based on account trust
- **Content Analysis** - Pattern-based spam detection
- **Bot Detection** - Browser fingerprinting and behavior analysis
- **IP Reputation** - Proxy/VPN detection and blocklists
- **Traffic Validation** - Anomaly detection and pattern analysis

---

## Architecture

### High-Level Flow

```
User Action
    │
    ▼
┌─────────────────────────────────────┐
│         Risk Assessment             │
│    (RiskScoringService.ts)          │
│                                     │
│  Combines signals from:             │
│  • Bot Detection (30%)              │
│  • IP Reputation (15%)              │
│  • Account Trust (25%)              │
│  • Behavioral Analysis (15%)        │
│  • Velocity Tracking (15%)          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         Risk Level Decision         │
├─────────────────────────────────────┤
│ 0-30:   ALLOW (no challenge)        │
│ 31-60:  SOFT CHALLENGE (invisible)  │
│ 61-85:  HARD CHALLENGE (visible)    │
│ 86-100: BLOCK (action denied)       │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     Challenge (if required)         │
│   (Cloudflare Turnstile)            │
│                                     │
│  • Invisible for low risk           │
│  • Visible widget for high risk     │
│  • Privacy-focused, no tracking     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│      Content Spam Check             │
│  (ContentSpamDetectionService.ts)   │
│                                     │
│  • Keyword filtering                │
│  • Link analysis                    │
│  • Duplicate detection              │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│         Rate Limit Check            │
│      (rateLimiter.ts)               │
│                                     │
│  • Tiered by account trust          │
│  • Redis for distributed            │
│  • Per-action limits                │
└─────────────────────────────────────┘
    │
    ▼
    Action Completed or Blocked
```

### Service Interaction Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Client                                       │
│                                                                          │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐ │
│  │ ChallengeWrapper│    │  turnstile.ts    │    │ BotDetectionService │ │
│  │   (React)       │───▶│  (utilities)     │    │ (fingerprinting)    │ │
│  └────────┬────────┘    └──────────────────┘    └──────────┬──────────┘ │
│           │                                                 │            │
└───────────┼─────────────────────────────────────────────────┼────────────┘
            │                                                 │
            ▼                                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            API Layer                                      │
│                                                                          │
│  ┌──────────────────────────┐                                            │
│  │  /api/risk-assessment    │◀───────────────────────────────────────────│
│  │    POST - assess risk    │                                            │
│  │    GET - user risk (admin)│                                           │
│  └────────────┬─────────────┘                                            │
│               │                                                          │
└───────────────┼──────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                     │
│                                                                          │
│  ┌───────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ RiskScoringService│  │AccountSecurity   │  │TurnstileVerification │ │
│  │ (orchestrator)    │◀▶│Service (trust)   │  │Service (CAPTCHA)     │ │
│  └─────────┬─────────┘  └──────────────────┘  └───────────────────────┘ │
│            │                                                             │
│            ▼                                                             │
│  ┌───────────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │
│  │ IPReputationService│  │ContentSpamDetect│  │VisitorValidation     │ │
│  │ (IP analysis)     │  │ionService        │  │Service (patterns)    │ │
│  └───────────────────┘  └──────────────────┘  └───────────────────────┘ │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    rateLimiter.ts                                 │  │
│  │  • MemoryStore (single instance)                                  │  │
│  │  • RedisStore (distributed via Upstash)                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Core Services

### 1. RiskScoringService

**File:** `app/services/RiskScoringService.ts`

Central risk calculation engine that combines multiple signals into a single risk score (0-100).

**Risk Factors & Weights:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Bot Detection | 30% | Browser fingerprint, user agent, automation indicators |
| IP Reputation | 15% | Proxy/VPN detection, blocklist status, datacenter detection |
| Account Trust | 25% | Account age, email verification, activity history |
| Behavioral | 15% | Session patterns, interaction rates, content velocity |
| Velocity | 15% | Rate of recent actions, limit violations |

**Risk Levels:**

| Score | Level | Action |
|-------|-------|--------|
| 0-30 | `allow` | No challenge required |
| 31-60 | `soft_challenge` | Invisible Turnstile challenge |
| 61-85 | `hard_challenge` | Visible Turnstile challenge |
| 86-100 | `block` | Action blocked, logged for review |

**Action Types:**
- `login` - User authentication
- `register` - New account creation
- `create_page` - Creating new pages
- `edit_page` - Editing existing pages
- `create_reply` - Creating replies/comments
- `send_message` - Sending messages
- `password_reset` - Password reset requests
- `email_change` - Email address changes
- `account_delete` - Account deletion

**Key Methods:**

```typescript
// Full risk assessment
const assessment = await RiskScoringService.assessRisk({
  action: 'create_page',
  userId: user.uid,
  ip: clientIP,
  userAgent: req.headers['user-agent'],
  fingerprint: browserFingerprint,
  sessionData: { duration: 120, interactions: 15, pageViews: 3 },
  contentLength: 500,
  hasLinks: true,
  linkCount: 2
});
// Returns: { score, level, factors, recommendation, reasons }

// Get user's current risk level (for admin)
const riskLevel = await RiskScoringService.getUserRiskLevel(userId);
// Returns: { score, level, factors, lastAssessment }

// Get user's risk history
const history = await RiskScoringService.getUserRiskHistory(userId, 10);
// Returns: Array of past assessments
```

---

### 2. BotDetectionService

**File:** `app/services/BotDetectionService.ts`

Detects automated traffic through user agent analysis and browser fingerprinting.

**Detection Methods:**

1. **User Agent Analysis**
   - Known bot user agents (Googlebot, Bingbot, scrapers, etc.)
   - Suspicious patterns (headless, phantom, selenium)
   - Missing legitimate browser signatures

2. **Browser Fingerprinting**
   - WebDriver detection
   - Headless browser detection
   - Screen resolution anomalies
   - Touch support inconsistencies
   - Hardware concurrency checks
   - Cookie support

3. **Behavioral Validation**
   - Page view velocity
   - Mouse/scroll interaction
   - Click patterns
   - Session duration

**Bot Categories:**
- `search_engine` - Google, Bing, DuckDuckGo, etc.
- `social_media` - Facebook, Twitter, LinkedIn crawlers
- `monitoring` - Pingdom, UptimeRobot, etc.
- `automation` - Selenium, Puppeteer, etc.
- `suspicious` - Unknown suspicious patterns
- `legitimate` - Normal user traffic

**Usage:**

```typescript
import { BotDetectionService } from './BotDetectionService';

// Basic detection from user agent
const result = BotDetectionService.detectBot(userAgent);
// Returns: { isBot, confidence, reasons, category }

// Enhanced detection with fingerprint
const fingerprint = BotDetectionService.generateFingerprint(); // client-side
const result = BotDetectionService.detectBot(userAgent, fingerprint);

// Validate session behavior
const behavior = BotDetectionService.validateVisitorBehavior({
  pageViews: 10,
  sessionDuration: 120,
  mouseMovements: 50,
  clicks: 8,
  scrollEvents: 15,
  keystrokes: 0
});
// Returns: { isSuspicious, reasons }
```

---

### 3. TurnstileVerificationService

**File:** `app/services/TurnstileVerificationService.ts`

Server-side verification of Cloudflare Turnstile tokens.

**Features:**
- Token verification with Cloudflare API
- IP address validation
- Hostname validation
- Error code handling
- Development mode bypass

**Usage:**

```typescript
import { verifyTurnstileToken, TurnstileVerificationResult } from './TurnstileVerificationService';

const result: TurnstileVerificationResult = await verifyTurnstileToken({
  token: clientToken,
  remoteIp: userIP,          // Optional but recommended
  expectedHostname: 'wewrite.app', // Optional
  expectedAction: 'login'    // Optional - matches action from widget
});

if (!result.success) {
  console.error('Challenge failed:', result.errorCodes);
  // Handle failure
}
```

**Error Codes:**
- `missing-input-secret` - Secret key not configured
- `invalid-input-secret` - Secret key is invalid
- `missing-input-response` - Token not provided
- `invalid-input-response` - Token is invalid or expired
- `bad-request` - Malformed request
- `timeout-or-duplicate` - Token already used or expired
- `internal-error` - Cloudflare internal error

---

### 4. ContentSpamDetectionService

**File:** `app/services/ContentSpamDetectionService.ts`

Analyzes content for spam patterns before publishing.

**Detection Categories:**

1. **Keyword Filtering**
   - Gambling (casino, betting, poker)
   - Pharma (viagra, cialis, steroids)
   - Crypto scams (guaranteed profits, pump and dump)
   - Phishing (account suspended, verify credentials)
   - MLM (downline, passive income schemes)

2. **Link Analysis**
   - Link density (links per word)
   - Suspicious domains
   - Shortened URLs (bit.ly, tinyurl)
   - Link limits based on account trust

3. **Content Patterns**
   - Excessive capitalization
   - Repetitive text
   - Character substitution (l33t speak)
   - Emoji spam
   - Excessive punctuation

4. **Duplicate Detection**
   - SHA-256 content hashing
   - Cross-user duplicate checking

**Spam Score Thresholds:**
- 0-30: Clean content
- 31-60: Suspicious, may need review
- 61-80: Likely spam, flag for review
- 81-100: Definite spam, block

**Usage:**

```typescript
import { getContentSpamDetectionService } from './ContentSpamDetectionService';

const spamService = getContentSpamDetectionService();
const result = await spamService.analyzeContent({
  content: pageContent,
  title: pageTitle,
  userId: user.uid,
  accountAgeDays: 30,
});

// Result structure:
{
  score: 45,           // 0-100
  isSpam: false,
  action: 'allow',     // 'allow' | 'review' | 'block'
  reasons: ['Contains promotional language'],
  categories: ['promotional'],
  linkAnalysis: {
    totalLinks: 2,
    suspiciousLinks: 0,
    linkDensity: 0.02
  }
}
```

---

### 5. AccountSecurityService

**File:** `app/services/AccountSecurityService.ts`

Manages account-level security and trust scoring.

**Trust Score Factors:**
- Account age (max 30 points)
- Email verification (20 points)
- Has published content (15 points)
- Has connected payment (10 points)
- Active in last 30 days (10 points)
- No security events (15 points)

**Trust Levels:**

| Level | Score | Restrictions |
|-------|-------|--------------|
| `new` | 0-19 | 3 pages/hour, 1 link max, CAPTCHA always |
| `basic` | 20-39 | 10 pages/hour, 3 links max, occasional CAPTCHA |
| `verified` | 40-59 | 20 pages/hour, 5 links max |
| `trusted` | 60-79 | No significant restrictions |
| `premium` | 80-100 | No restrictions |

**Security Event Types:**
- `suspicious_login` - Login from unusual location/device
- `rate_limit_exceeded` - Hit rate limits
- `spam_content_blocked` - Content flagged as spam
- `captcha_failed` - Failed CAPTCHA verification
- `password_reset_abuse` - Multiple password resets

**Disposable Email Detection:**
- Blocks 100+ known disposable email domains
- Includes: mailinator.com, tempmail.com, guerrillamail.com, etc.

**Usage:**

```typescript
import { getAccountSecurityService } from './AccountSecurityService';

const securityService = getAccountSecurityService();

// Get user trust level
const trustInfo = await securityService.getUserTrustLevel(userId);
// Returns: { score, level, factors, restrictions }

// Check if email is disposable
const isDisposable = securityService.isDisposableEmail('user@tempmail.com');
// Returns: true

// Record security event
await securityService.recordSecurityEvent(userId, 'rate_limit_exceeded', {
  endpoint: '/api/pages',
  timestamp: new Date()
});

// Check account creation velocity (anti-bot signup)
const canCreate = await securityService.checkAccountCreationVelocity(ipAddress);
// Returns: { allowed: boolean, reason?: string }
```

---

### 6. IPReputationService

**File:** `app/services/IPReputationService.ts`

IP address reputation checking and analysis.

**Features:**
- Proxy/VPN/TOR detection
- Datacenter IP detection
- Geographic anomaly detection (impossible travel)
- Local blocklist management
- Response caching (1 hour TTL)
- Optional IPQualityScore API integration

**Reputation Factors:**
- Known proxy/VPN provider
- Datacenter IP range
- Previous abuse reports
- Geographic location
- ASN reputation

**Usage:**

```typescript
import { getIPReputationService } from './IPReputationService';

const ipService = getIPReputationService();

// Check IP reputation
const reputation = await ipService.checkIP(ipAddress);
// Returns: {
//   score: 75,           // 0-100 (higher = more suspicious)
//   isProxy: false,
//   isVPN: true,
//   isTOR: false,
//   isDatacenter: false,
//   country: 'US',
//   isp: 'Comcast',
//   cached: false
// }

// Check for impossible travel
const travelCheck = await ipService.checkImpossibleTravel(userId, ipAddress);
// Returns: { suspicious: boolean, reason?: string }

// Add IP to local blocklist
await ipService.blockIP(ipAddress, 'Spam abuse', 24 * 60 * 60 * 1000); // 24 hours

// Check if IP is blocked
const isBlocked = await ipService.isBlocked(ipAddress);
```

---

### 7. VisitorValidationService

**File:** `app/services/VisitorValidationService.ts`

Traffic validation and anomaly detection service.

**Validation Thresholds:**
- Max visitors per minute: 100
- Max bot percentage: 30%
- Min session duration: 5 seconds
- Max page views per session: 50

**Anomaly Types:**
- `rapid_requests` - Traffic spike detected
- `unusual_patterns` - Abnormal behavior patterns
- `bot_surge` - Sudden increase in bot traffic
- `session_anomaly` - Suspicious session behavior

**Usage:**

```typescript
import { VisitorValidationService } from './VisitorValidationService';

// Validate current traffic metrics
const validation = await VisitorValidationService.validateCurrentMetrics();
// Returns: {
//   isValid: true,
//   confidence: 0.95,
//   issues: [],
//   recommendations: []
// }

// Analyze traffic patterns over time
const analysis = await VisitorValidationService.analyzeTrafficPatterns(24); // hours
// Returns: {
//   patterns: [...],
//   anomalies: [...],
//   summary: {
//     avgVisitorsPerHour: 150,
//     peakVisitors: 450,
//     avgBotPercentage: 12,
//     totalPageViews: 5000
//   }
// }

// Generate comprehensive validation report
const report = await VisitorValidationService.generateValidationReport();
// Returns: {
//   timestamp: Date,
//   currentMetrics: ValidationResult,
//   trafficAnalysis: {...},
//   recommendations: [...],
//   overallHealth: 'good' // 'excellent' | 'good' | 'warning' | 'critical'
// }
```

---

## Client-Side Components

### ChallengeWrapper Component

**File:** `app/components/auth/ChallengeWrapper.tsx`

React component that wraps forms to provide risk-based Turnstile challenges.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Form content to wrap |
| `onVerified` | `(token: string) => void` | - | Callback when verification succeeds |
| `onError` | `(error: string) => void` | - | Callback when verification fails |
| `onExpired` | `() => void` | - | Callback when token expires |
| `riskLevel` | `RiskLevel` | `'soft_challenge'` | Override risk level |
| `action` | `string` | - | Action name for analytics |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Widget theme |
| `mode` | `'inline' \| 'modal'` | `'inline'` | Display mode |
| `showLoading` | `boolean` | `true` | Show loading state |
| `disabled` | `boolean` | `false` | Disable challenge |

**Usage:**

```tsx
import { ChallengeWrapper, useChallengeToken } from '@/components/auth/ChallengeWrapper';

function LoginForm() {
  const { token, isVerified, handleVerified, handleError } = useChallengeToken();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isVerified) return;

    await loginUser({ email, password, turnstileToken: token });
  };

  return (
    <ChallengeWrapper
      onVerified={handleVerified}
      onError={handleError}
      riskLevel="soft_challenge"
      action="login"
    >
      <form onSubmit={handleSubmit}>
        <input type="email" name="email" />
        <input type="password" name="password" />
        <button type="submit" disabled={!isVerified}>
          Login
        </button>
      </form>
    </ChallengeWrapper>
  );
}
```

**States:**
- `idle` - Initial state
- `loading` - Loading Turnstile script
- `ready` - Widget rendered, waiting for verification
- `verifying` - Verification in progress
- `verified` - Challenge passed
- `error` - Verification failed
- `blocked` - Action blocked (risk level = block)

---

### Turnstile Client Utilities

**File:** `app/utils/turnstile.ts`

Low-level utilities for Turnstile widget management.

**Functions:**

```typescript
// Load Turnstile script dynamically
await loadTurnstileScript();

// Render a widget
const widgetId = await renderTurnstile(containerElement, {
  callback: (token) => console.log('Token:', token),
  'expired-callback': () => console.log('Expired'),
  'error-callback': (error) => console.log('Error:', error),
  theme: 'auto',
  size: 'normal', // 'normal' | 'compact' | 'invisible'
  action: 'login'
});

// Reset a widget
resetTurnstile(widgetId);

// Remove a widget
removeTurnstile(widgetId);

// Get response token
const token = getTurnstileResponse(widgetId);

// Check if expired
const expired = isTurnstileExpired(widgetId);

// Get size based on risk level
const size = getTurnstileSizeForRisk('hard_challenge'); // 'normal'

// Check if Turnstile is configured
const configured = isTurnstileConfigured();

// Check if should bypass (dev mode without keys)
const bypass = shouldBypassTurnstile();
```

---

## API Endpoints

### POST /api/risk-assessment

Perform a risk assessment for an action.

**Request:**

```typescript
{
  action: 'create_page' | 'login' | 'register' | ...,
  sessionData?: {
    duration: number,     // seconds
    interactions: number,
    pageViews: number
  },
  contentLength?: number,
  hasLinks?: boolean,
  linkCount?: number,
  fingerprint?: {
    userAgent: string,
    screenResolution: string,
    timezone: string,
    ...
  }
}
```

**Response:**

```typescript
{
  success: true,
  timestamp: '2024-01-15T12:00:00.000Z',
  data: {
    score: 35,
    level: 'soft_challenge',
    recommendation: 'Run invisible CAPTCHA verification',
    reasons: ['New account', 'First time action'],
    shouldChallenge: true,
    challengeType: 'invisible',
    factors: {
      botDetection: { score: 10 },
      accountTrust: { trustLevel: 'basic' },
      velocity: { exceededLimit: false }
    }
  }
}
```

### GET /api/risk-assessment?userId=xxx

Get risk level for a specific user (admin only).

**Query Parameters:**
- `userId` (required) - User ID to check
- `history` (optional) - Include risk history (`true`/`false`)

**Response:**

```typescript
{
  success: true,
  timestamp: '2024-01-15T12:00:00.000Z',
  data: {
    userId: 'abc123',
    score: 25,
    level: 'allow',
    factors: {
      botDetection: { score: 5, confidence: 0.1, reasons: [] },
      ipReputation: { score: 10, isProxy: false, isVPN: false },
      accountTrust: { score: 85, trustLevel: 'trusted' },
      behavioral: { score: 5, sessionDuration: 300 },
      velocity: { score: 0, exceededLimit: false }
    },
    lastAssessment: '2024-01-15T11:00:00.000Z',
    history: [...]  // if requested
  }
}
```

---

## Rate Limiting

**File:** `app/utils/rateLimiter.ts`

### Pre-configured Limiters

| Limiter | Window | Limit | Use Case |
|---------|--------|-------|----------|
| `authRateLimiter` | 15 min | 10 | Login attempts per IP |
| `passwordResetRateLimiter` | 1 hour | 5 | Password reset per email |
| `payoutRateLimiter` | 1 hour | 5 | Payout requests per user |
| `adminRateLimiter` | 1 min | 100 | Admin API calls |
| `webhookRateLimiter` | 1 min | 1000 | Webhook events |
| `stripeApiRateLimiter` | 1 min | 100 | Stripe API calls |
| `newAccountPageRateLimiter` | 1 hour | 3 | Pages for accounts <7 days |
| `regularPageRateLimiter` | 1 hour | 20 | Pages for accounts 7-90 days |
| `trustedPageRateLimiter` | 1 hour | 100 | Pages for trusted accounts |
| `replyRateLimiter` | 1 hour | 30 | Reply creation |
| `accountCreationRateLimiter` | 24 hours | 3 | Account creation per IP |

### Storage Backends

**MemoryStore (Default):**
- Single-instance rate limiting
- Automatic cleanup every 5 minutes
- Lost on server restart

**RedisStore (Distributed):**
- Uses Upstash Redis
- Survives server restarts
- Shared across instances

```typescript
import { RateLimiter, RedisStore, getRedisStore } from './rateLimiter';

// Using shared Redis store
const limiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  store: getRedisStore(),
  prefix: 'myapp'
});

// Check limit
const result = await limiter.checkLimit(userId);
if (!result.allowed) {
  throw new Error(`Rate limit exceeded. Try again at ${new Date(result.resetTime)}`);
}
```

### Helper Functions

```typescript
// Get appropriate limiter based on account trust
const limiter = getPageRateLimiter(accountAgeInDays, isTrusted);

// Check Stripe API limit
const { safe, remaining } = await checkStripeApiLimit();

// Exponential backoff for retries
const delay = calculateBackoffDelay(attempt, 1000, 30000);

// Wrap function with rate limiting
const rateLimitedFn = withRateLimit(
  originalFn,
  limiter,
  (userId) => userId
);
```

---

## Admin Integration

### RiskAssessmentSection Component

**File:** `app/components/admin/RiskAssessmentSection.tsx`

Displays user risk assessment in admin user details drawer.

**Features:**
- Visual risk gauge (0-100)
- Color-coded risk level badge
- Factor breakdown with scores
- Risk history timeline
- Refresh button

### RiskScoreBadge Component

**File:** `app/components/admin/RiskScoreBadge.tsx`

Compact risk score indicator for tables and lists.

**Props:**
- `score: number` - Risk score 0-100
- `level?: RiskLevel` - Optional level override
- `showTooltip?: boolean` - Show details on hover
- `size?: 'sm' | 'md' | 'lg'` - Badge size

**Colors:**
- Green: 0-30 (allow)
- Yellow: 31-60 (soft_challenge)
- Orange: 61-85 (hard_challenge)
- Red: 86-100 (block)

### Users Table Integration

The `/admin/users` page includes:
- Risk score column with color-coded badges
- Sortable by risk score
- Filter by risk level
- Click to view detailed risk assessment in drawer

---

## Configuration

### Environment Variables

```env
# Turnstile (Required for CAPTCHA)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key

# Redis (Optional - for distributed rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# IP Reputation (Optional - for enhanced IP checking)
IPQUALITYSCORE_API_KEY=xxx
```

### Risk Thresholds

In `RiskScoringService.ts`:

```typescript
const RISK_THRESHOLDS = {
  ALLOW: 30,           // Below this: no challenge
  SOFT_CHALLENGE: 60,  // Below this: invisible challenge
  HARD_CHALLENGE: 85,  // Below this: visible challenge
  // Above 85: block
};
```

### Trust Score Configuration

In `AccountSecurityService.ts`:

```typescript
const TRUST_FACTORS = {
  accountAge: { maxPoints: 30, daysForMax: 365 },
  emailVerified: { points: 20 },
  hasContent: { points: 15 },
  hasPayment: { points: 10 },
  recentActivity: { points: 10, daysThreshold: 30 },
  noSecurityEvents: { points: 15 }
};
```

---

## File Structure

```
app/
├── api/
│   └── risk-assessment/
│       └── route.ts              # Risk assessment API endpoint
├── components/
│   ├── admin/
│   │   ├── RiskAssessmentSection.tsx  # Admin risk display
│   │   └── RiskScoreBadge.tsx         # Risk score badge
│   └── auth/
│       └── ChallengeWrapper.tsx       # Turnstile wrapper component
├── services/
│   ├── RiskScoringService.ts          # Central risk orchestrator
│   ├── BotDetectionService.ts         # Bot/automation detection
│   ├── TurnstileVerificationService.ts # Server-side CAPTCHA
│   ├── ContentSpamDetectionService.ts  # Content analysis
│   ├── AccountSecurityService.ts       # Account trust scoring
│   ├── IPReputationService.ts          # IP reputation checking
│   └── VisitorValidationService.ts     # Traffic validation
└── utils/
    ├── rateLimiter.ts                 # Rate limiting utilities
    └── turnstile.ts                   # Client Turnstile utilities

docs/
└── security/
    └── ANTI_SPAM_SYSTEM.md            # This documentation
```

---

## Integration Guide

### Protecting a New Form

1. **Add ChallengeWrapper to your form:**

```tsx
import { ChallengeWrapper } from '@/components/auth/ChallengeWrapper';

function MyForm() {
  const [token, setToken] = useState<string | null>(null);

  return (
    <ChallengeWrapper
      onVerified={setToken}
      riskLevel="soft_challenge"
      action="my_action"
    >
      <form onSubmit={(e) => handleSubmit(e, token)}>
        {/* form fields */}
      </form>
    </ChallengeWrapper>
  );
}
```

2. **Verify token server-side:**

```typescript
import { verifyTurnstileToken } from '@/services/TurnstileVerificationService';

async function handleSubmit(data: FormData, token: string) {
  const verification = await verifyTurnstileToken({ token });
  if (!verification.success) {
    throw new Error('Security verification failed');
  }
  // Proceed with action
}
```

### Adding Risk Assessment to an API

```typescript
import { RiskScoringService } from '@/services/RiskScoringService';
import { getPageRateLimiter } from '@/utils/rateLimiter';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  const userId = await getUserIdFromRequest(request);

  // 1. Risk assessment
  const risk = await RiskScoringService.assessRisk({
    action: 'create_page',
    userId,
    ip,
    userAgent
  });

  if (risk.level === 'block') {
    return NextResponse.json({ error: 'Action blocked' }, { status: 403 });
  }

  // 2. Rate limit check
  const accountAge = await getAccountAge(userId);
  const limiter = getPageRateLimiter(accountAge, risk.factors.accountTrust.trustLevel === 'trusted');
  const rateLimit = await limiter.checkLimit(userId);

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // 3. Content spam check (if applicable)
  const spamResult = await getContentSpamDetectionService().analyzeContent({
    content: body.content,
    userId,
    accountAgeDays: accountAge
  });

  if (spamResult.action === 'block') {
    return NextResponse.json({ error: 'Content flagged as spam' }, { status: 400 });
  }

  // Proceed with action
}
```

---

## Monitoring & Debugging

### Logging Prefixes

All services log with consistent prefixes:
- `[RiskScoring]` - Risk assessment events
- `[Turnstile]` - CAPTCHA verification
- `[BotDetection]` - Bot detection results
- `[IPReputation]` - IP checks
- `[AccountSecurity]` - Account security events
- `[ContentSpam]` - Content analysis
- `[RedisStore]` - Rate limiting errors
- `[VisitorValidation]` - Traffic validation

### Key Metrics to Monitor

1. **Risk Score Distribution**
   - Track average risk scores over time
   - Alert on sudden increases

2. **Challenge Rates**
   - Soft challenge frequency
   - Hard challenge frequency
   - Block rate

3. **Challenge Completion**
   - Success rate for visible challenges
   - Failure/abandon rate

4. **Rate Limit Hits**
   - Which limits are being hit most
   - By user segment

5. **Spam Detection**
   - False positive rate (legitimate content blocked)
   - False negative rate (spam getting through)

### Development Mode

In development without Turnstile keys:
- CAPTCHA verification is bypassed
- `test_token` is accepted
- Warning logged to console

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `riskEvents` | Risk assessment history |
| `ipBlocklist` | Manually blocked IPs |
| `ipReputationCache` | Cached IP reputation (1h TTL) |
| `accountVelocity` | Account creation tracking |
| `securityEvents` | User security event log |
| `contentHashes` | Content duplicate detection |

---

## Related Documentation

- [Bot Detection Service](../architecture/CURRENT_ARCHITECTURE.md#bot-detection)
- [Authentication System](../auth/AUTH_SYSTEM.md)
- [Current Architecture](../architecture/CURRENT_ARCHITECTURE.md)
