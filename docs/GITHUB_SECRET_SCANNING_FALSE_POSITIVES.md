# GitHub Secret Scanning False Positives

## Overview
GitHub's secret scanning occasionally triggers false positives in our repository. This document explains why and how to handle them.

## Confirmed False Positives (August 2025)

### Google API Keys
**Alert Pattern**: `AIzaSy...`
**Source**: Regex pattern in `app/utils/secureLogging.ts`
```typescript
pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
```
**Status**: ✅ False positive - This is a regex pattern for detecting secrets, not an actual secret

### Stripe API Keys
**Alert Pattern**: `sk_test_51...`, `pk_test_...`
**Source**: 
1. Regex pattern in `app/utils/secureLogging.ts`
2. Documentation examples in various docs
3. Test mock values

**Status**: ✅ False positive - These are patterns and examples, not actual secrets

### Stripe Webhook Secrets
**Alert Pattern**: `whsec_...`
**Source**: Documentation examples showing webhook configuration
**Status**: ✅ False positive - Example values in documentation

## Why These Occur

### 1. Security Logging Patterns
Our `secureLogging.ts` file contains regex patterns to detect and redact secrets from logs:
```typescript
const SENSITIVE_PATTERNS = [
  {
    pattern: /\b(sk_live_|sk_test_|pk_live_|pk_test_)[A-Za-z0-9]{20,}/g,
    replacement: '[API_KEY_REDACTED]'
  },
  {
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
    replacement: '[FIREBASE_KEY_REDACTED]'
  }
];
```

GitHub's scanner sees these patterns and flags them as potential secrets.

### 2. Documentation Examples
Our comprehensive documentation includes example configurations:
```bash
# Example (not real)
STRIPE_WEBHOOK_SECRET=whsec_example_webhook_secret
```

### 3. Test Mock Values
Test files contain mock API keys for testing:
```javascript
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
```

## How to Handle Future Alerts

### 1. Verify First
Before taking action:
- Check if the flagged key matches your actual keys in Google Cloud/Stripe
- Look at the file/line where the "secret" was found
- Determine if it's a pattern, example, or actual secret

### 2. If False Positive
- Go to GitHub → Security → Secret scanning alerts
- Click on the alert
- Click "Dismiss alert"
- Select "False positive" as the reason
- Add a note explaining why (e.g., "Regex pattern in security code")

### 3. If Real Secret
- Immediately rotate the key in the respective service
- Update environment variables
- Follow the security incident response procedures

## Prevention Strategies

### 1. Comment Patterns Clearly
```typescript
// Regex pattern for detecting Firebase API keys in logs - NOT an actual key
pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g,
```

### 2. Use Obviously Fake Examples
```bash
# Use clearly fake examples in documentation
STRIPE_SECRET_KEY=sk_test_EXAMPLE_NOT_REAL_KEY_123456789
```

### 3. Exclude Files in .gitignore
Already implemented:
```gitignore
# Never commit actual secrets
.env*.local
.env
*.env
```

## Verification Checklist

When a GitHub alert appears:
- [ ] Check the actual file/line flagged
- [ ] Compare with your real keys in the service dashboards
- [ ] Verify it's not in git history: `git log -S "suspicious_key"`
- [ ] Check if it's a pattern, example, or test value
- [ ] If false positive: dismiss the alert
- [ ] If real secret: follow incident response procedures

## Current Status

**All GitHub secret scanning alerts as of August 2025 are confirmed false positives.**

**No action required** - keys do not need to be rotated.

---

**Last Updated**: August 1, 2025  
**Next Review**: When new alerts appear  
**Status**: All current alerts are false positives ✅
