# WeWrite Testing Strategy

## Overview

WeWrite uses a layered testing approach across web and mobile:

| Layer | Tool | Scope | Location |
|-------|------|-------|----------|
| Unit tests | Jest + Testing Library | Components, hooks, utilities | `app/**/__tests__/` |
| Integration tests | Jest | API routes, services, data flows | `app/tests/` |
| E2E tests (web) | Playwright | Full browser flows, navigation, SEO | `e2e/` |
| E2E tests (mobile) | Maestro *(planned)* | iOS/Android UI flows | `wewrite-mobile` repo |

---

## Web: Unit & Integration Tests (Jest)

**Run:** `bun test` / `bun test:watch` / `bun test:coverage`

Jest is configured for component-level and service-level testing with jsdom environment and Testing Library for React components.

**Coverage thresholds:** 70% across branches, functions, lines, and statements.

**Key test suites:**
- `app/utils/__tests__/` — Utility function tests
- `app/components/ui/__tests__/` — UI component tests
- `app/components/payments/__tests__/` — Payment flow tests
- `app/hooks/__tests__/` — Custom hook tests
- `app/tests/` — Integration and system tests

---

## Web: E2E Tests (Playwright)

**Run:**
```bash
bun test:e2e          # Headless (CI-friendly)
bun test:e2e:ui       # Interactive UI mode
bun test:e2e:headed   # Headed browser
```

**Config:** `playwright.config.ts`

**Test directory:** `e2e/`

### What to test with Playwright
- **Smoke tests** — Critical pages load without errors
- **Navigation** — Public and auth-gated routes behave correctly
- **SEO** — Meta tags, status codes, structured data present
- **Auth flows** — Login, register, password reset work end-to-end
- **Core user flows** — Create page, edit, publish, allocate funds
- **Responsive** — Mobile and desktop viewports render correctly

### Projects
- `chromium` — Desktop Chrome
- `mobile-chrome` — Pixel 5 viewport (mobile web)

### CI Integration
Playwright is configured with:
- `github` reporter for CI (annotations on PRs)
- Retries (2x) in CI for flake resilience
- Screenshots on failure
- Traces on first retry for debugging

### Writing new E2E tests
```typescript
import { test, expect } from '@playwright/test';

test('user can view a public page', async ({ page }) => {
  await page.goto('/trending');
  await expect(page.locator('h1')).toBeVisible();
});
```

---

## Mobile: E2E Tests (Maestro) — Planned

The mobile app will live in a separate repository (`WeWriteApp/wewrite-mobile`) built with React Native and Expo.

**Recommended tool:** [Maestro](https://maestro.dev)

### Why Maestro for mobile
- Simple YAML-based test flows — no code required for basic tests
- First-class React Native and Expo support
- Maestro Studio for visual test recording
- Cross-platform: same flows run on iOS and Android
- CI integration via Maestro Cloud

### Example Maestro flow
```yaml
appId: app.wewrite.mobile
---
- launchApp
- assertVisible: "Welcome to WeWrite"
- tapOn: "Sign In"
- inputText:
    id: "email-input"
    text: "test@example.com"
- tapOn: "Continue"
- assertVisible: "Home"
```

### Mobile test strategy
- **Smoke tests** — App launches, auth screens render
- **Auth flows** — Sign in, sign up, password reset
- **Core flows** — Create page, browse, search, follow users
- **Push notifications** — Notification receipt and deep linking
- **Offline behavior** — Graceful degradation without network

---

## Testing Priorities

### Phase 1 (Current)
- [x] Jest unit tests for utilities and components
- [x] Playwright smoke tests for critical pages
- [ ] Playwright auth flow tests
- [ ] Playwright page creation flow

### Phase 2
- [ ] Playwright payment/subscription flows (with test Stripe keys)
- [ ] Playwright search functionality
- [ ] CI pipeline integration (GitHub Actions)

### Phase 3 (Mobile)
- [ ] Maestro setup in `wewrite-mobile` repo
- [ ] Mobile smoke tests
- [ ] Mobile auth and core flow tests
- [ ] Maestro Cloud CI integration
