# WeWrite Anti-Spam & Anti-Bot Protection System

Technical documentation for WeWrite's comprehensive anti-spam and anti-bot protection system.

## System Overview

The anti-spam system uses a multi-layered approach combining risk scoring, CAPTCHA challenges, rate limiting, and content analysis to prevent spam while minimizing friction for legitimate users.

### Architecture Diagram

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
    Action Completed or Blocked
```

## Core Services

### 1. RiskScoringService (`app/services/RiskScoringService.ts`)

Central risk calculation engine that combines multiple signals into a single risk score.

**Risk Factors & Weights:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Bot Detection | 30% | Browser fingerprint, user agent, automation indicators |
| IP Reputation | 15% | Proxy/VPN detection, blocklist status, datacenter detection |
| Account Trust | 25% | Account age, email verification, activity history |
| Behavioral | 15% | Session patterns, interaction rates, content velocity |
| Velocity | 15% | Rate of recent actions, limit violations |

**Key Methods:**

```typescript
// Full risk assessment
const assessment = await riskService.assessRisk(userId, actionType, context);
// Returns: { score, level, factors, action, reasons }

// Quick check for basic decisions
const riskLevel = await riskService.quickRiskCheck(userId);
// Returns: 'allow' | 'soft_challenge' | 'hard_challenge' | 'block'

// Get user's risk history
const history = await riskService.getUserRiskHistory(userId, limit);
```

**Action Types:**
- `content_creation` - Creating pages or replies
- `account_creation` - New user registration
- `login` - User authentication
- `sensitive_action` - Financial or security actions

### 2. TurnstileVerificationService (`app/services/TurnstileVerificationService.ts`)

Server-side Cloudflare Turnstile token verification.

**Environment Variables Required:**
```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxx  # Public key for widget
TURNSTILE_SECRET_KEY=xxx             # Secret key for verification
```

**Usage:**
```typescript
import { verifyTurnstileToken } from './TurnstileVerificationService';

const result = await verifyTurnstileToken({
  token: clientToken,
  remoteIp: userIP,
});

if (!result.success) {
  // Challenge failed - block action
}
```

### 3. ContentSpamDetectionService (`app/services/ContentSpamDetectionService.ts`)

Analyzes content for spam indicators before publishing.

**Detection Methods:**

1. **Keyword Filtering** - Categories: gambling, pharma, crypto scams, phishing, MLM
2. **Link Analysis** - Suspicious domains, link limits based on account trust
3. **Duplicate Detection** - SHA-256 hash comparison
4. **Pattern Detection** - Repetitive text, excessive caps

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

if (result.action === 'block') {
  // Content is spam - reject
}
```

### 4. AccountSecurityService (`app/services/AccountSecurityService.ts`)

Account-level security including disposable email detection and trust scoring.

**Features:**
- Disposable email domain blocklist (100+ domains)
- Account creation velocity limits (3 per IP per 24h)
- Trust score calculation

**Trust Levels:**
| Level | Score | Restrictions |
|-------|-------|--------------|
| new | 0-19 | 3 pages/hour, 1 link max, CAPTCHA always |
| basic | 20-39 | 10 pages/hour, 3 links max, occasional CAPTCHA |
| verified | 40-59 | 20 pages/hour, 5 links max |
| trusted | 60-79 | No significant restrictions |
| premium | 80-100 | No restrictions |

### 5. IPReputationService (`app/services/IPReputationService.ts`)

IP address reputation checking and blocklist management.

**Features:**
- Integration with IPQualityScore API (optional)
- Proxy/VPN/TOR detection
- Datacenter IP detection
- Local blocklist management
- Geographic anomaly detection (impossible travel)
- Response caching (1 hour TTL)

**Environment Variables (optional):**
```env
IPQUALITYSCORE_API_KEY=xxx  # For external IP reputation API
```

### 6. Rate Limiter (`app/utils/rateLimiter.ts`)

Distributed rate limiting with Redis support.

**Pre-configured Limiters:**

| Limiter | Window | Limit | Use Case |
|---------|--------|-------|----------|
| newAccountPageRateLimiter | 1 hour | 3 | Page creation for accounts <7 days |
| regularPageRateLimiter | 1 hour | 20 | Page creation for accounts 7-90 days |
| trustedPageRateLimiter | 1 hour | 100 | Page creation for trusted accounts |
| replyRateLimiter | 1 hour | 30 | Reply creation |
| accountCreationRateLimiter | 24 hours | 3 | Account creation per IP |
| authRateLimiter | 15 min | 10 | Login attempts per IP |

**Redis Support:**
```env
UPSTASH_REDIS_REST_URL=xxx   # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=xxx # Upstash Redis token
```

## Risk-Based Challenge Flow

```typescript
// Example: Page creation flow
async function createPage(userId: string, content: string, ip: string) {
  // 1. Risk Assessment
  const risk = await riskService.assessRisk(userId, 'content_creation', { ip });

  // 2. Handle based on risk level
  switch (risk.action) {
    case 'block':
      throw new Error('Action blocked due to high risk');

    case 'hard_challenge':
      // Require visible CAPTCHA
      if (!await verifyCaptcha()) {
        throw new Error('CAPTCHA verification required');
      }
      break;

    case 'soft_challenge':
      // Run invisible CAPTCHA
      await runInvisibleCaptcha();
      break;

    case 'allow':
      // No challenge needed
      break;
  }

  // 3. Content spam check
  const spamResult = await spamService.analyzeContent({ content, userId });
  if (spamResult.action === 'block') {
    throw new Error('Content appears to be spam');
  }

  // 4. Rate limit check
  const rateLimit = await getPageRateLimiter(accountAge, isTrusted).checkLimit(userId);
  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded');
  }

  // 5. Create page
  return await createPageInDB(content);
}
```

## Firestore Collections

| Collection | Purpose |
|------------|---------|
| `riskEvents` | Risk assessment history for each user |
| `ipBlocklist` | Manually blocked IP addresses |
| `ipReputationCache` | Cached IP reputation results |
| `accountVelocity` | Account creation tracking by IP |

## Admin UI Integration

### Users Table (`/admin/users/`)

The admin users table includes a Risk Score column showing:
- Color-coded badge (green/yellow/orange/red)
- Score value (0-100)
- Tooltip with level description

### User Details Drawer

The Risk Assessment section shows:
- Overall risk score with visual gauge
- Risk level badge with explanation
- Factor breakdown:
  - Bot Detection confidence
  - IP Reputation score
  - Account Trust level
  - Behavioral signals
  - Velocity metrics
- Recent risk history

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

### Tuning Risk Thresholds

Risk thresholds are defined in `RiskScoringService.ts`:

```typescript
const RISK_THRESHOLDS = {
  ALLOW: 30,           // Below this: no challenge
  SOFT_CHALLENGE: 60,  // Below this: invisible challenge
  HARD_CHALLENGE: 85,  // Below this: visible challenge
  // Above 85: block
};
```

### Adjusting Rate Limits

Rate limits can be adjusted in `rateLimiter.ts`:

```typescript
export const newAccountPageRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,           // Change this value
});
```

## Development Mode

In development without Turnstile keys configured:
- CAPTCHA verification is bypassed
- A warning is logged
- Test token `test_token` is accepted

## Monitoring

### Logging

All services log with prefixes:
- `[RiskScoring]` - Risk assessment events
- `[Turnstile]` - CAPTCHA verification
- `[IPReputation]` - IP checks
- `[AccountSecurity]` - Account security events
- `[RedisStore]` - Rate limiting errors

### Metrics to Monitor

1. Risk score distribution over time
2. Challenge completion rates
3. Block rates by action type
4. Rate limit hit frequency
5. Spam detection accuracy (false positive rate)

## Related Documentation

- [Bot Detection Service](../architecture/CURRENT_ARCHITECTURE.md#bot-detection)
- [Admin Users Guide](../admin/SPAM_MONITORING.md)
