# Legacy Code Cleanup Guide

## 🧹 Overview

This guide documents old patterns and legacy code that must be identified and removed during cleanup runs. It serves as a reference for maintaining code quality and security.

## ✅ Recently Completed Cleanups

### Payment Feature Flags (COMPLETED 2025-01-24)
All payment feature flags have been **completely removed**. Payments are now always enabled throughout the application.

### Theme Switching Optimization (COMPLETED 2025-01-24)
Optimized theme switching to eliminate delays. Logo and Stripe Elements now switch themes instantly using `resolvedTheme` and CSS-based approaches.

## 🔒 CRITICAL: Security Vulnerabilities to Remove

### Email Exposure Patterns ⚠️

**IMMEDIATE REMOVAL REQUIRED** - These patterns expose user email addresses:

#### ❌ Direct Email Display
```typescript
// REMOVE THESE PATTERNS
<span>{user.email}</span>
<div>{activity.username || user.email}</div>
const displayName = username || email || 'Anonymous';
const fallback = email.split('@')[0];
```

#### ❌ Unsanitized Username Props
```typescript
// REMOVE THESE PATTERNS
<UsernameBadge username={user.email} />
<ActivityCard username={activity.username || user.email} />
{username.includes('@') ? username : 'Loading...'} // Still shows email briefly
```

#### ✅ Replace With Secure Patterns
```typescript
import { sanitizeUsername } from '../../utils/usernameSecurity';

// USE THESE PATTERNS
<UsernameBadge username={sanitizeUsername(initialUsername)} />
<span>{sanitizeUsername(username)}</span>
const safeUsername = getDisplayUsername(username, isLoading);
```

## 📊 Deprecated System Patterns

### Old Activity System ❌

**REMOVE ALL REFERENCES** - The activity system has been replaced with the unified version system:

#### Files to Delete
```bash
# These files should no longer exist
app/api/activity/route.js
app/hooks/useRecentActivity.js
app/components/features/RecentActivity.tsx
app/components/features/RecentActivityHeader.tsx
app/services/activityService.ts
app/api/test-activity/route.js
```

#### Code Patterns to Remove
```typescript
// REMOVE THESE PATTERNS
import { createActivity } from '../services/activityService';
await createActivity(pageId, userId, 'edit');
const activities = await getActivities();
db.collection('activities').add(activityData);
```

#### ✅ Replace With Version System
```typescript
// USE THESE PATTERNS
import { createVersion } from '../utils/versionUtils';
await createVersion(pageId, content, userId);
const versions = await getPageVersions(pageId);
db.collection('pages').doc(pageId).collection('versions').add(versionData);
```

### Old Authentication Patterns ❌

**REMOVE INCONSISTENT AUTH** - Multiple auth systems have been unified:

#### Deprecated Auth Imports
```typescript
// REMOVE THESE PATTERNS
import { oldAuth } from '../firebase/oldAuth';
import { legacyAuthProvider } from '../providers/LegacyAuth';
import { simpleAuth } from '../auth/simple';
```

#### ✅ Replace With Unified Auth
```typescript
// USE THESE PATTERNS
import { useAuth } from '../providers/AuthProvider';
import { getUserIdFromRequest } from '../auth-helper';
```

## 🗄️ Database Collection Patterns

### Old Collection Names ❌

**REMOVE REFERENCES** - Environment-aware collections are now standard:

#### Deprecated Collection References
```typescript
// REMOVE THESE PATTERNS
db.collection('activities')
db.collection('old_pages')
db.collection('legacy_users')
db.collection('temp_subscriptions')
```

#### ✅ Replace With Environment-Aware Collections
```typescript
// USE THESE PATTERNS
import { getCollectionName } from '../utils/environment';
db.collection(getCollectionName('pages'))
db.collection(getCollectionName('users'))
db.collection(getCollectionName('subscriptions'))
```

## 🎨 UI Pattern Cleanup

### Deprecated Component Patterns ❌

#### Old Modal Patterns
```typescript
// REMOVE THESE PATTERNS
import { OldModal } from '../components/OldModal';
import { LegacyDialog } from '../components/LegacyDialog';
<OldModal isOpen={true} />
```

#### Old Styling Patterns
```typescript
// REMOVE THESE PATTERNS
className="old-border-style"
style={{ border: '1px solid #ccc' }} // Use design system
<div className="legacy-container">
```

#### Payment Feature Flag Patterns ❌ **CRITICAL REMOVAL**
```typescript
// REMOVE THESE PATTERNS - PAYMENTS ARE ALWAYS ENABLED
const paymentsEnabled = true; // Delete this line
const isPaymentsEnabled = true; // Delete this line
if (!paymentsEnabled) { return null; } // Delete entire conditional
if (!isPaymentsEnabled) { // Delete entire conditional
  return <PaymentsComingSoon />;
}
{paymentsEnabled && <Component />} // Remove condition, keep component
{isPaymentsEnabled ? <Component /> : <Fallback />} // Remove condition, keep component
```

#### Theme Detection Patterns ❌
```typescript
// REMOVE THESE PATTERNS - CAUSES THEME SWITCHING DELAYS
const [mounted, setMounted] = useState(false);
if (!mounted) return '/images/logos/logo-light.svg';
theme === 'dark' // Use resolvedTheme instead
```

#### ✅ Replace With Modern Patterns
```typescript
// USE THESE PATTERNS
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/utils';
<Modal variant="fullscreen" />
className={cn("border-border", additionalClasses)}

// CORRECT: Always show payment components
<PaymentComponent /> // No feature flag needed

// CORRECT: Use resolvedTheme for instant theme switching
const { resolvedTheme } = useTheme();
resolvedTheme === 'dark' ? 'night' : 'stripe'
```

## 🔍 Search Patterns for Cleanup

### Automated Search Commands

Use these commands to find legacy patterns:

#### Security Vulnerabilities
```bash
# Find email exposure patterns
grep -r "\.email" app/components/ --include="*.tsx" --include="*.ts"
grep -r "split('@')" app/ --include="*.tsx" --include="*.ts"
grep -r "username.*@\|@.*username" app/ --include="*.tsx" --include="*.ts"
```

#### Deprecated Systems
```bash
# Find old activity system references
grep -r "activityService\|createActivity\|getActivities" app/
grep -r "collection('activities')" app/
grep -r "useRecentActivity" app/

# Find old auth patterns
grep -r "oldAuth\|legacyAuth\|simpleAuth" app/
grep -r "LegacyAuth\|OldAuth" app/

# Find payment feature flags (SHOULD BE REMOVED)
grep -r "paymentsEnabled\|isPaymentsEnabled" app/
grep -r "Payments.*enabled\|payments.*feature.*flag" app/
grep -r "Payments Coming Soon" app/
```

#### Database Collection Issues
```bash
# Find hardcoded collection names
grep -r "collection('pages')\|collection('users')" app/ --exclude-dir=node_modules
grep -r "DEV_\|PROD_" app/ --include="*.ts" --include="*.tsx"
```

#### Theme and UI Issues
```bash
# Find old theme patterns that cause delays
grep -r "mounted.*theme\|theme.*mounted" app/
grep -r "!mounted.*return" app/components/ --include="*.tsx"
grep -r "theme.*===.*'dark'" app/ | grep -v "resolvedTheme"
```

## 📋 Cleanup Checklist

### Security Cleanup
- [ ] Search for email exposure patterns
- [ ] Verify all username displays use `sanitizeUsername()`
- [ ] Check loading states don't show email addresses
- [ ] Audit all user data display components
- [ ] Test with email addresses as initial username values

### System Cleanup
- [ ] Remove all activity system references
- [ ] Update to unified version system
- [ ] Remove old authentication imports
- [ ] Update to environment-aware collections
- [ ] Remove deprecated UI components
- [ ] **CRITICAL**: Remove all payment feature flags (`paymentsEnabled`, `isPaymentsEnabled`)
- [ ] **CRITICAL**: Remove "Payments Coming Soon" messages and fallbacks

### Theme and UI Cleanup
- [ ] Replace `theme` with `resolvedTheme` for instant theme switching
- [ ] Remove hydration mismatch prevention that causes delays
- [ ] Update Stripe Elements to use `resolvedTheme` for dark mode
- [ ] Remove mounted state checks that delay theme detection

### Code Quality
- [ ] Remove unused imports
- [ ] Delete commented-out code
- [ ] Update outdated comments
- [ ] Remove console.log statements
- [ ] Clean up temporary variables

## 🚨 High-Priority Cleanup Areas

### 1. Username Security (CRITICAL)
- **Priority**: Immediate
- **Risk**: Email exposure vulnerability
- **Action**: Audit all username displays

### 2. Activity System Migration
- **Priority**: High
- **Risk**: Data inconsistency
- **Action**: Remove all activity system code

### 3. Authentication Unification
- **Priority**: High
- **Risk**: Auth failures
- **Action**: Remove old auth patterns

### 4. Collection Name Standardization
- **Priority**: Medium
- **Risk**: Environment confusion
- **Action**: Use environment-aware collections

## 📁 Files Requiring Regular Audit

### High-Risk Files (Check Monthly)
- All components in `app/components/ui/` (username displays)
- All API routes in `app/api/` (data fetching)
- Authentication providers and helpers
- User data fetching utilities

### Medium-Risk Files (Check Quarterly)
- Page components and layouts
- Settings and profile pages
- Admin dashboard components
- Test files and mock data

## 🔄 Maintenance Schedule

### Weekly
- [ ] Search for new email exposure patterns
- [ ] Check for new activity system references
- [ ] Audit recent commits for deprecated patterns

### Monthly
- [ ] Full security audit of username displays
- [ ] Review authentication code for consistency
- [ ] Check database collection usage

### Quarterly
- [ ] Comprehensive cleanup run
- [ ] Update this guide with new patterns
- [ ] Review and update search commands
- [ ] Document new deprecated patterns

## 📚 Related Documentation

- **[Username Security Guidelines](./USERNAME_SECURITY_GUIDELINES.md)** - Complete security documentation
- **[Version System](./VERSION_SYSTEM.md)** - New unified system documentation
- **[Authentication Architecture](./AUTHENTICATION_ARCHITECTURE.md)** - Auth system documentation
- **[User Data Fetching Patterns](./USER_DATA_FETCHING_PATTERNS.md)** - Data fetching standards

---

**Remember: Regular cleanup prevents technical debt accumulation and maintains system security and reliability.**
