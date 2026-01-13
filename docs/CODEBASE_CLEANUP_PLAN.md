# WeWrite Codebase Cleanup Plan

**Generated:** January 2026
**Purpose:** Comprehensive analysis of code simplification opportunities, dead code, documentation drift, and architectural improvements.

---

## Executive Summary

| Category | Issues Found | Status | Lines Saved |
|----------|-------------|--------|-------------|
| Dead/Disabled Code | 5+ services | ✅ Analyzed (cost-optimized) | N/A |
| Duplicate Code - API Client | 1,006 lines | ✅ COMPLETED | 425 lines (42%) |
| Duplicate Code - Validation | 21+ files | ✅ COMPLETED | ~200 lines |
| Unused Error Boundaries | 3 files | ✅ COMPLETED | 410 lines |
| Documentation Drift | 9 critical discrepancies | ✅ COMPLETED | N/A |
| Spaghetti Code | 7 major files | ⏳ Pending | ~9,000 lines |

**Completed Cleanup:** ~1,035 lines removed, validation centralized across 11 files
**Remaining Potential:** ~45% reduction in spaghetti code areas

---

## PHASE 1: CRITICAL FIXES (Do First)

### 1.1 Broken Code - VisitorValidationService.ts ✅ COMPLETED

**File:** `app/services/VisitorValidationService.ts`
**Issue:** `validateCurrentMetrics()` method references undefined variable `sessions`
**Impact:** Method will crash if called

**Fix Applied:**
- Removed broken session-level validation code that referenced undefined `sessions` variable
- Migrated `analyzeTrafficPatterns()` from broken direct Firebase calls to use `visitorValidationApi.getTrafficPatterns()` API
- Added explanatory comment about the migration

### 1.2 Documentation - Subscription Tier Amounts ✅ COMPLETED

**CRITICAL DISCREPANCY:**
- **Docs said:** $5/$25/$50 tiers
- **Code has:** $10/$20/$30 tiers

**Fix Applied:**
- Updated `docs/payments/SUBSCRIPTION_SYSTEM.md` with correct tier amounts
- Also fixed custom tier range from "$100+" to "$30-$1000"

### 1.3 Documentation - Platform Fee Percentage ✅ COMPLETED

**CRITICAL DISCREPANCY:**
- `FINANCIAL_DATA_ARCHITECTURE.md` said: 7%
- `app/config/platformFee.ts` (actual): **10%**
- Admin UI tooltips: Incorrectly showed 7%

**Fix Applied:**
- Updated `docs/payments/FINANCIAL_DATA_ARCHITECTURE.md` from 7% to 10%
- Updated all 7% references in `app/admin/monthly-financials/page.tsx` to 10% (6 instances fixed)

### 1.4 Documentation - Context Naming ✅ COMPLETED

**Issue:** Docs referenced `FakeBalanceContext` but code uses `DemoBalanceContext`

**Fix Applied:**
- Updated `docs/architecture/CURRENT_ARCHITECTURE.md` (line 135)
- Updated `docs/payments/FINANCIAL_DATA_ARCHITECTURE.md` (all FakeBalance → DemoBalance references)

---

## PHASE 2: DEAD CODE REMOVAL (High Impact, Low Risk)

### 2.1 Deprecated Component - TokenPieChart.tsx ✅ COMPLETED

**File:** `app/components/ui/TokenPieChart.tsx` (192 lines)
**Status:** DEPRECATED - Already wrapped in UsdPieChart.tsx

**Fix Applied:**
- Deleted `app/components/ui/TokenPieChart.tsx`
- Updated test file to import `TokenPieChart` from `UsdPieChart.tsx` (backward-compatible export)

### 2.2 Cost-Optimized Services ✅ ANALYZED

**Analysis (January 2026):** These services were labeled "disabled" but are actually **cost-optimized** - they've been migrated from real-time Firebase listeners to API-based polling to reduce Firebase costs.

| Service | File | Status | Used By | Verdict |
|---------|------|--------|---------|---------|
| VisitorTrackingService | `app/services/VisitorTrackingService.ts` | Partially disabled - `trackVisitor()`, `setupHeartbeat()`, `subscribeToVisitorCount()` return mock data | LiveVisitorsWidget (admin only) | **KEEP** - Admin widget shows zeros, but service still has cleanup/analytics methods |
| StatsService | `app/services/StatsService.ts` | **FUNCTIONAL** - Only `subscribeToPageStats()` disabled, all other methods work | useUnifiedStats.ts | **KEEP** - Core stats functionality works via API polling |
| ContributorsService | `app/services/ContributorsService.ts` | **FUNCTIONAL** - Migrated to API-based polling | useContributorCount.ts | **KEEP** - Fully working via `contributorsApi` |

**Conclusion:**
- ✅ **StatsService** and **ContributorsService** are NOT disabled - they're cost-optimized and working correctly
- ⚠️ **VisitorTrackingService** has some disabled methods, but this is intentional for cost savings
- The only visible impact is LiveVisitorsWidget showing zeros on admin/product-kpis page

**Action:** No changes needed. The "disabled" label was misleading - these are intentional cost optimizations.

### 2.3 TODO/FIXME Markers

**88 instances found.** Key incomplete features:

| Location | Issue |
|----------|-------|
| `settings/notifications/page.tsx:308` | Load preferences from API not implemented |
| `firebase/pageViews.ts:630` | 24h view tracking uses synthetic data |
| `api/pages/[id]/route.ts:37` | Repair logic not implemented |
| `api/payouts/history/route.ts:191` | Stripe payout integration pending |

---

## PHASE 3: DUPLICATE CODE CONSOLIDATION

### 3.1 Logging Systems ⏸️ NOT DUPLICATES - KEEP AS-IS

**Analysis:** These three systems serve **different purposes** and aren't true duplicates:

| File | Purpose | Key Features |
|------|---------|--------------|
| `logger.ts` (366 lines) | General purpose logging | Deduplication, terminal integration |
| `secureLogging.ts` (317 lines) | Security audit logging | Sanitizes emails/tokens/passwords |
| `detailedErrorLogging.ts` (320 lines) | React error handling | Hydration errors, error boundaries |

**Recommendation:** Keep as-is. Merging would lose specialized functionality.

### 3.2 Fee Calculations Async Duplication ⏸️ INTENTIONAL PATTERN

**File:** `app/utils/feeCalculations.ts` (696 lines)

**Analysis:** Sync/async pairs are **intentional resilience pattern**:
- Sync functions use hardcoded `WEWRITE_FEE_STRUCTURE` (10% fee) as fallback
- Async functions fetch dynamic fee from Firebase
- Comments indicate migration to `FeeConfigurationService` is complete
- Main exports used by other files are just `WEWRITE_FEE_STRUCTURE` and `getMinimumPayoutThreshold`

**Recommendation:** Keep as-is. The sync functions serve as fallbacks when Firebase is unavailable.

### 3.3 Cache Implementations (9 files) ⏸️ DEFERRED - HIGH RISK

**Current state:** 9 cache files actively used by 12+ files across the codebase.

**Files:**
- `cacheUtils.ts` - Generic localStorage cache with TTL
- `userCache.ts` - User profile caching
- `searchCache.ts` - Search results caching
- `financialDataCache.ts` - Financial data caching
- `pagesListCache.ts` - Pages list caching
- `graphDataCache.ts` - Graph/connection data
- `serverCache.ts` - Server-side caching
- `globalCacheInvalidation.ts` - Cross-cache invalidation
- `clearDeletedPageCaches.ts` - Page deletion cleanup

**Recommendation:** Defer this work. The caches serve different purposes (client vs server, different domains). Creating a generic CacheManager would require refactoring 12+ files and could introduce regressions. The existing `globalCacheInvalidation.ts` already coordinates cross-cache invalidation.

**Previous consolidation attempt in cleanup plan:**
```typescript
class CacheManager<T> {
  constructor(key: string, ttl: number = 5 * 60 * 1000) {}
  async get(fetchFn: () => Promise<T>): Promise<T> {}
  invalidate(): void {}
}

// Usage
const userCache = new CacheManager<UserData>('user', 5 * 60 * 1000);
```

**Estimated reduction:** 60% (~1,200 lines saved)

### 3.4 API Client Patterns ✅ COMPLETED

**File:** `app/utils/apiClient.ts`
**Before:** 1,006 lines | **After:** 581 lines | **Saved:** 425 lines (42%)

**Work Completed (January 2026):**
1. Analyzed actual API usage across 20+ files using parallel agents
2. Removed unused API methods based on codebase-wide usage analysis
3. Consolidated repetitive patterns with inline comments

**APIs Removed (zero usage):**
- `searchApi` - not used anywhere
- `homeApi` - not used anywhere
- `batchApi` - not used anywhere
- `visitorTrackingApi` - imported but methods never called
- `linksApi` - not used anywhere

**Methods Removed from Active APIs:**
- `userProfileApi`: removed `updateProfile`, `logout`
- `pageApi`: removed `getUserPages`, `createPage`, `updatePage`, `deletePage`
- `analyticsApi`: removed 6 methods, kept only `recordPageView`, `getUserStreaks`
- `followsApi`: removed `getFollowedPages`, `getPageFollowers`, `getUserFollowers`
- `dailyNotesApi`: removed 3 methods, kept only `getLatestDailyNote`
- `visitorValidationApi`: removed `validateVisitor`, kept only `getTrafficPatterns`
- `versionsApi`: removed `getVersions`, `createVersion`

**Preserved (with active usage):**
- `userProfileApi.getProfile`, `userProfileApi.getBatchUsers`
- `usernameApi.checkAvailability`, `usernameApi.setUsername`
- `pageApi.getPage`, `pageApi.getSimilarPages`, `pageApi.appendReference`
- `analyticsApi.recordPageView`, `analyticsApi.getUserStreaks`
- `followsApi.followPage`, `followsApi.unfollowPage`, `followsApi.followUser`, `followsApi.unfollowUser`, `followsApi.getFollowedUsers`, `followsApi.getFollowSuggestions`
- `contributorsApi.getContributors`
- `rtdbApi` (all methods - preserved for future use)
- `versionsApi.setCurrentVersion`
- `dailyNotesApi.getLatestDailyNote`
- `visitorValidationApi.getTrafficPatterns`

### 3.5 Validation Functions ✅ COMPLETED

**Work Completed (January 2026):**

1. **Created centralized `app/utils/validationPatterns.ts`** (~280 lines)
   - Single source of truth for all validation patterns
   - Email validation: `EMAIL_REGEX`, `EMAIL_REGEX_STRICT`, `isValidEmail()`, `isValidEmailStrict()`, `looksLikeEmail()`
   - Username validation: `USERNAME_REGEX`, `validateUsernameFormat()`, `isValidUsernameString()`
   - Added `RESERVED_USERNAMES` list (30+ reserved names)
   - URL, Page ID, User ID, Search term, Password validation functions
   - Exported grouped constants: `ValidationPatterns`, `ValidationFunctions`

2. **Updated files to use centralized validation:**
   - `app/utils/usernameValidation.ts` - Now re-exports from validationPatterns.ts
   - `app/components/forms/UnifiedFormValidation.tsx` - Imports validators instead of duplicating
   - `app/components/forms/login-form.tsx` - Uses `looksLikeEmail()`
   - `app/components/forms/forgot-password-form.tsx` - Uses `isValidEmail()`
   - `app/components/forms/register-form.tsx` - Uses `isValidEmail()`
   - `app/firebase/auth.ts` - Uses `isValidEmail()`
   - `app/components/auth/EmailVerificationModal.tsx` - Uses `isValidEmail()`
   - `app/api/auth/reset-password/route.ts` - Uses `isValidEmailStrict()`
   - `app/api/auth/register/route.ts` - Uses `isValidEmailStrict()`
   - `app/api/debug/password-reset/route.ts` - Uses `isValidEmailStrict()`
   - `app/api/users/update-email/route.ts` - Uses `isValidEmailStrict()`

3. **Added reserved username checking to client-side validation**
   - `RESERVED_USERNAMES` array prevents registration of system usernames
   - Includes: admin, support, wewrite, api, settings, profile, etc.

**Benefits:**
- Eliminated 10+ duplicate email regex patterns
- Single source of truth for all validation
- Client uses lenient `isValidEmail()`, server uses strict `isValidEmailStrict()`
- Reserved usernames now blocked at client-side before API call

**Files kept separate (intentionally):**
- `inputValidation.ts` - Server-side API validation with dangerous pattern detection
- `contentValidation.ts` - Slate.js content structure validation
- `linkValidator.ts` - Link data normalization (different domain)
- `usernameSecurity.ts` - Display-time security (sanitization, not validation)

### 3.6 Error Boundaries ✅ COMPLETED

**Work Completed (January 2026):**

Analysis revealed only 1 Error Boundary is actually used in production:
- `UnifiedErrorBoundary.tsx` - Used by layout.tsx, ContentPageView.tsx, product-kpis/page.tsx

**Files Deleted (unused, ~410 lines saved):**
- `app/components/utils/ProviderErrorLogger.tsx` (120 lines) - Not imported anywhere
- `app/components/admin/DashboardErrorBoundary.tsx` (162 lines) - Not imported anywhere
- `app/components/editor/TextViewErrorBoundary.tsx` (128 lines) - Not imported anywhere

**Note:** The original plan suggested consolidating into EnhancedErrorBoundary, but analysis showed
3 of 4 implementations were simply unused. Deleting unused code is simpler than refactoring.

---

## PHASE 4: SPAGHETTI CODE REFACTORING

### 4.1 ContentPageView.tsx (CRITICAL - 2,372 lines)

**Location:** `app/components/pages/ContentPageView.tsx`

**Problems:**
- 40+ state variables
- 6-level deep nesting
- Functions over 200 lines
- Mixed concerns (loading, saving, editing, keyboard shortcuts, location, dates)

**Proposed split:**

| New File | Lines | Responsibility |
|----------|-------|----------------|
| `hooks/usePageState.ts` | ~150 | State initialization/sync |
| `hooks/usePageLoading.ts` | ~100 | Page fetching/hydration |
| `hooks/usePageSave.ts` | ~200 | Save/auto-save logic |
| `hooks/useNewPageMode.ts` | ~80 | New page creation flow |
| `hooks/usePageKeyboard.ts` | ~50 | Keyboard shortcuts |
| `ContentPageView.tsx` | ~500 | UI composition only |

**Estimated effort:** 8-12 hours

### 4.2 links.ts (1,037 lines) ⏸️ DEFERRED - LOW ROI

**Location:** `app/firebase/database/links.ts`

**Analysis (January 2026):**
Upon closer inspection, the file structure is:
- `extractLinksFromNodes()` - 166 lines, core link extraction logic (complex but functional)
- URL utilities (`extractDomainFromUrl`, `sanitizeLinkUrl`) - ~55 lines (minimal, could extract)
- Firebase-dependent functions - ~750+ lines (findBacklinks, findPagesLinkingToExternalUrl, getUserExternalLinks, etc.)

**Why Deferred:**
1. Extracting URL utilities would only save ~55 lines and create new imports across 2 files
2. The real complexity is in `extractLinksFromNodes()` which handles 10+ link type detection patterns
3. Firebase functions are tightly coupled and don't benefit from extraction
4. Higher ROI items (pageService, stripe webhook) remain pending

**Original Fix Proposal (kept for reference):**
```typescript
class LinkTypeDetector {
  static detectPageLink(node): PageLink | null
  static detectUserLink(node): UserLink | null
  static detectExternalLink(node): ExternalLink | null
}
```

**Recommendation:** Revisit after higher-priority refactors are complete

### 4.3 api/pages/route.ts (1,385 lines) ⏸️ DEFERRED - HIGH RISK

**Location:** `app/api/pages/route.ts`

**Analysis (January 2026):**
The file structure by method:
- **GET** (~180 lines): Page listing with aggressive caching (pagesListCache, serverCache)
- **POST** (~310 lines): Page creation with versioning, Algolia/Typesense sync, notifications
- **PUT** (~680 lines): Complex update logic with version batching, diff computation, background ops
- **DELETE** (~170 lines): Soft/permanent deletion with backlinks, allocations, search cleanup

**Why Deferred:**
1. High risk of regressions - PUT handler has 10+ integrated subsystems
2. Tight coupling to version system (`saveNewVersionServer`), search engines, cache layers
3. Background operations (backlinks, external links, graph cache, notifications) are fire-and-forget
4. Content validation is already abstracted in the version saving system
5. Extracting to pageService would require careful testing of all integrations

**Original Fix Proposal (kept for reference):**
```
services/pageService.ts - Business logic
utils/contentValidator.ts - Content parsing
```

**Recommendation:** Tackle after establishing comprehensive test coverage for page operations

### 4.4 stripe-subscription webhook (1,198 lines) ⏸️ DEFERRED - WORKING WELL

**Location:** `app/api/webhooks/stripe-subscription/route.ts`

**Analysis (January 2026):**
File structure by handler:
- **POST main** (~160 lines): Signature verification, idempotency, dispatcher switch
- **handleCheckoutSessionCompleted** (~20 lines): Simple delegation
- **handleSubscriptionUpdated** (~70 lines): Status sync with Firestore
- **handleSubscriptionDeleted** (~45 lines): Cancel subscription, reset allocation
- **handlePaymentSucceeded** (~235 lines): Most complex - tracking, email, allocation
- **handlePaymentFailed** (~80 lines): Payment recovery, notifications
- **handleChargeRefunded** (~155 lines): Refund processing, allocation reduction
- **handleDisputeCreated** (~125 lines): Freeze allocations
- **handleDisputeClosed** (~155 lines): Resolve frozen allocations
- **Helpers** (~130 lines): createCriticalAlert, fallback logging

**Why Deferred:**
1. The code is already well-organized with clear handler separation
2. Each handler is exported and can be tested independently
3. Shared patterns (stripe client, db, idempotency) would need extraction
4. Payment webhooks are critical infrastructure - avoid unnecessary changes
5. No current bugs or performance issues reported

**Original Fix Proposal (kept for reference):**
```
├── stripe-webhook-handler.ts (dispatcher)
├── handlers/
│   ├── checkout-session-handler.ts
│   ├── subscription-handlers.ts (created/updated/deleted)
│   ├── payment-handlers.ts (succeeded/failed)
│   ├── refund-handler.ts
│   └── dispute-handlers.ts
├── utils/
│   └── webhook-helpers.ts (createCriticalAlert, fallback logging)
```

**Recommendation:** Only refactor if new event types are added or maintenance becomes difficult

---

## PHASE 5: DOCUMENTATION SYNC

### Updates Required

| Document | Issue | Fix |
|----------|-------|-----|
| `SUBSCRIPTION_SYSTEM.md` | Wrong tier amounts ($5/$25/$50) | Change to $10/$20/$30 |
| `SUBSCRIPTION_SYSTEM.md` | Custom tier min $100 | Change to $30 |
| `FINANCIAL_DATA_ARCHITECTURE.md` | Platform fee 7% | Change to 10% |
| `FINANCIAL_DATA_ARCHITECTURE.md` | FakeBalanceContext | Change to DemoBalanceContext |
| `CURRENT_ARCHITECTURE.md` | FakeBalanceContext | Change to DemoBalanceContext |
| `SUBSCRIPTION_QUICK_REFERENCE.md` | Incomplete | Add tier details |
| Admin UI tooltip | Platform fee 7% | Change to 10% |

---

## Implementation Priority

### Week 1: Critical Fixes
- [ ] Fix VisitorValidationService undefined variable
- [ ] Update documentation discrepancies (subscription tiers, platform fee)
- [ ] Delete TokenPieChart.tsx

### Week 2: Quick Wins
- [ ] Consolidate logging systems
- [ ] Remove fee calculation async duplicates
- [ ] Extract ContentValidator from pages route

### Week 3-4: Major Refactors
- [ ] Split ContentPageView.tsx into hooks
- [ ] Simplify links.ts extraction logic
- [ ] Create generic CacheManager

### Ongoing
- [ ] Address TODO markers as features are built
- [ ] Keep System Diagram updated per CLAUDE.md
- [ ] Consider removing disabled visitor tracking services

---

## Metrics to Track

After cleanup:
- [ ] Bundle size reduction
- [ ] Lines of code reduction
- [ ] Test coverage improvement
- [ ] Build time improvement
- [ ] Developer onboarding time

---

## Notes

- The "cost optimization" disabled services pattern suggests these were intentionally disabled. Verify with team before removing.
- ContentPageView.tsx refactoring is highest ROI but also highest risk - ensure good test coverage first.
- Documentation sync should happen alongside code changes to prevent future drift.
