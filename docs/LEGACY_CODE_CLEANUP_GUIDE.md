# Legacy Code Cleanup Guide

## 🧹 Overview

This guide documents old patterns and legacy code that must be identified and removed during cleanup runs. It serves as a reference for maintaining code quality and security.

## ✅ Recently Completed Cleanups

### Content Display System Unification (COMPLETED 2025-01-25)
**MAJOR REFACTORING**: Replaced scattered editor/viewer components with unified `ContentDisplay` architecture:
- **REMOVED**: `Editor.tsx` wrapper component (redundant)
- **UNIFIED**: All content display through single `ContentDisplay` component
- **UPDATED**: CSS classes to `wewrite-*` naming convention
- **IMPROVED**: Diff algorithm for intelligent change detection

### Diff Algorithm Enhancement (COMPLETED 2025-01-25)
**CRITICAL FIX**: Replaced simplistic diff algorithm with intelligent word-level LCS algorithm:
- **FIXED**: Recent edits showing entire lines as both added and removed
- **IMPROVED**: Now shows only actual changes, not entire line replacements
- **ENHANCED**: Word-level diffing with proper longest common subsequence

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

### Old Content Display System ❌ **NEW - HIGH PRIORITY**

**REMOVE ALL REFERENCES** - The scattered editor/viewer system has been replaced with unified `ContentDisplay`:

#### Files to Delete
```bash
# These files should no longer exist
app/components/editor/Editor.tsx  # REMOVED - redundant wrapper
```

#### Code Patterns to Remove
```typescript
// REMOVE THESE PATTERNS
import Editor from "../components/editor/Editor";
import { Editor } from "../components/editor/Editor";

// Complex conditional rendering
{shouldUseEditor ? (
  <Editor readOnly={!canEdit} />
) : (
  <ContentViewer />
)}

// Old CSS classes
className="editor-container"
className="content-viewer-container"
className="content-viewer"
```

#### ✅ Replace With Unified System
```typescript
// USE THESE PATTERNS
import ContentDisplay from "../components/content/ContentDisplay";

// Simple unified rendering
<ContentDisplay
  content={content}
  isEditable={canEdit}
  onChange={handleChange}
/>

// New CSS classes
className="wewrite-editor-container"
className="wewrite-viewer-container"
className="wewrite-content-display"
```

### Old Diff Algorithm ❌ **NEW - CRITICAL**

**REMOVE SIMPLE DIFF LOGIC** - The prefix/suffix diff algorithm has been replaced with intelligent LCS:

#### Code Patterns to Remove
```typescript
// REMOVE THESE PATTERNS - CAUSES POOR DIFF DISPLAY
// Simple prefix/suffix algorithm that marks entire sections as changed
function simpleDiff(oldText, newText) {
  // Find prefix/suffix, mark middle as both added and removed
  const oldMiddle = oldText.substring(prefixLength, oldText.length - suffixLength);
  const newMiddle = newText.substring(prefixLength, newText.length - suffixLength);

  if (oldMiddle && newMiddle) {
    // This causes entire lines to show as both red and green
    operations.push({ type: 'remove', text: oldMiddle });
    operations.push({ type: 'add', text: newMiddle });
  }
}
```

#### ✅ Replace With Intelligent Algorithm
```typescript
// USE THESE PATTERNS - PROPER WORD-LEVEL DIFFING
import { calculateDiff } from '../utils/diffService';

// Intelligent word-level diff with LCS
const diffResult = await calculateDiff(currentContent, previousContent);
// Shows only actual changes, not entire line replacements
```

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

#### 🎨 Content Display Issues (NEW 2025 - HIGH PRIORITY)
```bash
# Find old Editor component imports
grep -r "from.*editor/Editor" app/ --include="*.tsx" --include="*.ts"
grep -r "import.*Editor.*from.*editor/Editor" app/ --include="*.tsx"

# Find old CSS classes
grep -r "editor-container\|content-viewer-container" app/ --include="*.tsx" --include="*.css"
grep -r "content-viewer[^-]" app/ --include="*.tsx" --include="*.css"

# Find complex conditional rendering
grep -r "shouldUseEditor\|useEditor.*?" app/ --include="*.tsx"
grep -r "Editor.*readOnly\|readOnly.*Editor" app/ --include="*.tsx"

# Find old diff algorithm patterns
grep -r "prefixLength.*suffixLength" app/api/ --include="*.ts"
grep -r "oldMiddle.*newMiddle" app/api/ --include="*.ts"
grep -r "substring.*substring" app/api/diff/ --include="*.ts"
```

#### 🎨 UI/Styling Issues (NEW 2024)
```bash
# Find inconsistent padding patterns
grep -r "px-[123][^0-9]" app/components/ --include="*.tsx"
grep -r "py-0\.5\|py-1[^0-9]" app/components/ --include="*.tsx"
grep -r "p-[123][^0-9]" app/components/ --include="*.tsx"

# Find hardcoded border colors
grep -r "border-gray\|border-neutral\|border-slate" app/ --include="*.tsx"
grep -r "dark:border-" app/ --include="*.tsx"
grep -r "border-muted-foreground/20" app/components/ --include="*.tsx"

# Find inconsistent focus states
grep -r "focus:border-blue\|focus:ring-blue" app/components/ --include="*.tsx"
grep -r "focus:ring-1[^0-9]" app/components/ --include="*.tsx"

# Find complex layout patterns
grep -r "absolute inset-0" app/components/ --include="*.tsx"
grep -r "flex.*flex.*flex" app/components/ --include="*.tsx"
grep -r "relative.*absolute.*relative" app/components/ --include="*.tsx"

# Find multiple modal patterns
grep -r "Modal.*Modal" app/components/ --include="*.tsx"
find app/components -name "*Modal.tsx" -o -name "*Dialog.tsx"
```

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

### 🎨 Content Display Cleanup (NEW 2025 - CRITICAL PRIORITY)
- [ ] Search for old Editor component imports (`from.*editor/Editor`)
- [ ] Remove redundant Editor.tsx wrapper component references
- [ ] Update old CSS classes to `wewrite-*` naming convention
- [ ] Replace complex conditional rendering with unified `ContentDisplay`
- [ ] Verify all content display uses new architecture
- [ ] Remove old diff algorithm patterns (prefix/suffix logic)
- [ ] Test Recent Edits shows intelligent diffs, not entire line changes
- [ ] Update any remaining `editor-container` or `content-viewer-container` classes

### 🎨 UI/Styling Cleanup (NEW 2024 - HIGH PRIORITY)
- [ ] Search for inconsistent padding patterns (px-1, px-2, px-3, py-0.5, py-1)
- [ ] Replace with standardized px-4 and py-2/py-4 patterns
- [ ] Find hardcoded border colors (border-gray, border-neutral, dark:border-)
- [ ] Replace with theme-aware borders (border-muted-foreground/30, border-primary/50)
- [ ] Find inconsistent focus states (focus:border-blue, focus:ring-1)
- [ ] Replace with unified focus system (border-primary/50 ring-2 ring-primary/20)
- [ ] Audit complex layout patterns for simplification opportunities
- [ ] Consolidate multiple modal components into single global modal
- [ ] Verify all page elements use consistent px-4 padding alignment

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

### 1. Content Display System (CRITICAL - NEW 2025)
- **Priority**: Immediate
- **Risk**: Build failures, inconsistent UX
- **Action**: Remove old Editor.tsx references, update CSS classes
- **Search**: `grep -r "from.*editor/Editor" app/`

### 2. Diff Algorithm (CRITICAL - NEW 2025)
- **Priority**: Immediate
- **Risk**: Poor user experience in Recent Edits
- **Action**: Remove simple prefix/suffix diff logic
- **Search**: `grep -r "oldMiddle.*newMiddle" app/api/`

### 3. Username Security (CRITICAL)
- **Priority**: Immediate
- **Risk**: Email exposure vulnerability
- **Action**: Audit all username displays

### 4. Activity System Migration
- **Priority**: High
- **Risk**: Data inconsistency
- **Action**: Remove all activity system code

### 5. Authentication Unification
- **Priority**: High
- **Risk**: Auth failures
- **Action**: Remove old auth patterns

### 6. Collection Name Standardization
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
