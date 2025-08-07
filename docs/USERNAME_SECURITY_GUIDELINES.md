# Username Security Guidelines

## 🔒 CRITICAL SECURITY ISSUE: Email Address Exposure Prevention

### **Security Problem**

**NEVER expose email addresses as username fallbacks in the UI.** This is a critical privacy/security vulnerability that can expose user email addresses to other users.

### **Common Vulnerability Patterns** ⚠️

These patterns MUST be identified and eliminated during cleanup runs:

#### ❌ **DANGEROUS: Direct Email Display**
```typescript
// NEVER DO THIS - Exposes email addresses
<span>{user.email}</span>
<span>{activity.username || user.email}</span>
<span>{username.includes('@') ? username : 'Loading...'}</span> // Still shows email briefly
```

#### ❌ **DANGEROUS: Email-Based Fallbacks**
```typescript
// NEVER DO THIS - Uses email as username
const displayName = username || user.email || 'Anonymous';
const fallbackUsername = email.split('@')[0]; // Exposes email prefix
```

#### ❌ **DANGEROUS: Unsanitized Props**
```typescript
// NEVER DO THIS - Passes email directly to display components
<UsernameBadge username={user.email} />
<ActivityCard username={activity.username || user.email} />
```

### **Secure Implementation Patterns** ✅

#### ✅ **CORRECT: Use Security Utilities**
```typescript
import { sanitizeUsername, getDisplayUsername } from '../../utils/usernameSecurity';

// Safe username display
const displayName = sanitizeUsername(username);
const safeUsername = getDisplayUsername(username, isLoading);
```

#### ✅ **CORRECT: Component Implementation**
```typescript
// Safe UsernameBadge usage
<UsernameBadge 
  userId={userId} 
  username={sanitizeUsername(initialUsername)} 
/>

// Safe direct display
<span>{sanitizeUsername(username, 'Loading...', 'Missing username')}</span>
```

## 🛡️ Security Utilities

### Core Security Functions

Located in `app/utils/usernameSecurity.ts`:

#### `sanitizeUsername(username, loadingText?, fallbackText?)`
- **Purpose**: Ensures email addresses are never displayed
- **Returns**: Safe username or appropriate fallback
- **Usage**: Use for all username displays

#### `needsUsernameRefresh(username)`
- **Purpose**: Detects when username needs API refresh
- **Returns**: Boolean indicating if refresh needed
- **Usage**: Use in components to trigger data fetching

#### `getDisplayUsername(username, isLoading?)`
- **Purpose**: Gets safe display username with loading states
- **Returns**: Safe username with proper loading handling
- **Usage**: Use when you have loading state information

#### `isEmailAddress(username)`
- **Purpose**: Detects if a string is an email address
- **Returns**: Boolean indicating if string contains '@'
- **Usage**: Use for validation and security checks

## 🔍 Cleanup Identification Guide

### Finding Vulnerable Code

When performing cleanup runs, search for these patterns:

#### Search Terms for Vulnerable Code
```bash
# Search for email exposure patterns
grep -r "\.email" app/components/
grep -r "split('@')" app/
grep -r "username.*@" app/
grep -r "@.*username" app/
```

#### File Patterns to Check
- Any component that displays usernames
- Activity cards and user badges
- Recent edits and version history
- Sidebar and profile displays
- Sample data and mock components

### Red Flags in Code Review

1. **Direct email usage**: `user.email`, `activity.email`
2. **Email splitting**: `email.split('@')[0]`
3. **Unsanitized fallbacks**: `username || email`
4. **Missing sanitization**: Direct username display without security utils
5. **Loading state exposure**: Showing email during loading

## 📋 Security Checklist

### For New Components
- [ ] Import security utilities from `usernameSecurity.ts`
- [ ] Use `sanitizeUsername()` for all username displays
- [ ] Never use email addresses as username fallbacks
- [ ] Handle loading states with "Loading..." text
- [ ] Test with email addresses as initial username values

### For Existing Components
- [ ] Audit all username display logic
- [ ] Replace direct username displays with sanitized versions
- [ ] Remove any email-based fallback logic
- [ ] Update loading states to use security utilities
- [ ] Test that email addresses are never visible

### For API Endpoints
- [ ] Ensure APIs don't return email addresses as usernames
- [ ] Validate that username fields contain proper usernames
- [ ] Add server-side sanitization if needed
- [ ] Document expected username format

### For Search Systems
- [ ] Never search by email addresses
- [ ] Filter out users without proper usernames from results
- [ ] Never include email information in search responses
- [ ] Use "Missing username" fallback for invalid usernames
- [ ] Exclude users with email-like usernames from search results

## 🚨 Emergency Response

### If Email Exposure is Discovered

1. **Immediate Action**: Deploy fix to prevent further exposure
2. **Audit**: Check logs for any exposed email addresses
3. **Notification**: Consider notifying affected users if exposure was significant
4. **Review**: Conduct security review of all username displays

### Testing for Vulnerabilities

```typescript
// Test cases to verify security
const testCases = [
  'user@example.com',           // Should show "Loading..." or "Missing username"
  'test.user@domain.co.uk',     // Should show "Loading..." or "Missing username"
  '',                           // Should show "Missing username"
  null,                         // Should show "Missing username"
  undefined,                    // Should show "Missing username"
  'validusername'               // Should show "validusername"
];

testCases.forEach(username => {
  const result = sanitizeUsername(username);
  console.log(`Input: ${username} → Output: ${result}`);
  // Verify no email addresses are returned
});
```

## 📁 Protected Components

### Components with Security Measures
- ✅ `UsernameBadge.tsx` - Uses security utilities
- ✅ `UserBadge.js` - Uses sanitization
- ✅ `ActivityCard.tsx` - Sanitizes sample data
- ✅ `VersionDetailView.tsx` - Sanitizes version authors
- ✅ `UnifiedSidebar.tsx` - Sanitizes sidebar display

### Components to Audit Regularly
- Any new user display components
- Activity and version history components
- Profile and settings pages
- Admin dashboard components
- Sample data and mock displays

## 🔄 Maintenance

### Regular Security Audits
1. **Monthly**: Search codebase for new email exposure patterns
2. **Before releases**: Run security checklist on all username displays
3. **After new features**: Audit any new user-facing components
4. **Code reviews**: Check all username-related changes

### Documentation Updates
- Update this document when new security patterns are discovered
- Add new vulnerable patterns to the identification guide
- Document any new security utilities or patterns
- Keep examples current with codebase changes

## 📚 Related Documentation

- `app/utils/usernameSecurity.ts` - Security utility functions
- `docs/USER_DATA_FETCHING_PATTERNS.md` - User data fetching standards
- `docs/AUTHENTICATION_ARCHITECTURE.md` - Authentication security
- Component documentation for UsernameBadge and related components

---

**Remember: User privacy is paramount. Email addresses must NEVER be exposed as username fallbacks under any circumstances.**
