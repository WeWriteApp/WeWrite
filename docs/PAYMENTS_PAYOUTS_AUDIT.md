## Payments & Payouts Audit Checklist

**Environment**
- Confirm Stripe test mode in dev: `/api/debug/stripe-env` → `stripeLiveMode=false`.
- Ensure `STRIPE_SECRET_KEY` (test) is set; `NEXT_PUBLIC_STRIPE_TEST_MODE` true in dev.

**Allocation → Earnings**
- Allocation writes `usdAllocations`, updates `userUsdBalances` (available/pending) via environment-aware collection names.
- `/api/earnings/user` reflects allocations; monthly rollover clears pending→available as designed.

**Payout Request Flow (Single Path)**
- Uses `PayoutService` (unified) + storage balance transfers (`processPayoutFromStorage`) in test mode.
- Enforces minimum/available balance; on success: decrement available, insert payout history with `transferId`. On failure: no balance change, store error.
- Clear errors for missing bank/connected account or insufficient balance.

**Connected Account Status (UI/API)**
- `/api/stripe/account-status` returns payouts_enabled/charges_enabled/details_submitted, requirements, bank last4, cached `lastKnownBank`.
- UI shows single card with status badges; copyable account ID; onboarding button if not connected.

**Notifications & Logging**
- Payout success/failure emits notification (payout_completed / payout_failed).
- Structured logs include `userId`, `accountId`, `transferId`, or `error`.

**Admin Financial Tests**
- Test endpoints write test ledger/batch and (when `connectedAccountId` provided) call Stripe test transfer via `processPayoutFromStorage`; store `transferId/error` on batch.
- Cleanup endpoint clears test collections.

**Monthly Processing**
- Cron (`/api/payouts/process-monthly`) runs `PayoutService.processAllPending` (storage balance transfers).

**Reconciliation**
- For a dev test user: sum allocations → available/pending; minus payouts → expected balance.
- Stripe test storage balance approximates creator obligations.

**Action Items**
- Validate collection usage in allocation/earnings APIs (dev confirms correct prefixes via /api/debug/earnings-status).
- Verify payout request API calls storage payout in test mode and records history/error.
- Add/verify notifications on payout success/failure.
- Run admin financial test with a Stripe test connected account and confirm transfer shows in Stripe test dashboard.
