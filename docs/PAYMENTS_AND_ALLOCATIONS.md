# Payments & Allocations Handbook

## What this replaces
- Subscription/allocations/balance docs: `USD_PAYMENT_SYSTEM.md`, `SUBSCRIPTION_SYSTEM.md`, `SUBSCRIPTION_QUICK_REFERENCE.md`, `PAYMENT_SYSTEM_GUIDE.md`, `PAYMENT_FLOW_TESTING_GUIDE.md`.
- Storage balance & payouts: `STORAGE_BALANCE_GUIDE.md`, `STORAGE_BALANCE_SYSTEM_AUDIT.md`, `STORAGE_BALANCE_TESTING_GUIDE.md`, `PAYOUT_SYSTEM_INDEX.md`, `PAYOUT_TROUBLESHOOTING_GUIDE.md`, `PAYMENTS_PAYOUTS_AUDIT.md`.
- Fees: `PLATFORM_FEE_MANAGEMENT_SYSTEM.md` (plus the archived August 2025 update note).
- Troubleshooting: `SUBSCRIPTION_TROUBLESHOOTING.md`, `PAYMENT_FAILURE_TRACKING.md` (archived), `ENHANCED_PAYMENT_ERROR_MESSAGING.md` (archived).

## Core flow (one view)
`Subscription (Stripe)` → `USD balance (usdBalances)` → `Allocations (usdAllocations)` → `Storage balance + earnings` → `Payouts`.

- **Subscriptions**: Stripe webhooks create/refresh `usdBalances` (total/monthly/available). Overspending allowed; unfunded allocations are tracked client-side.
- **Allocations**: Records live in `usdAllocations` with `month` for reporting. Intent is persistent month-to-month—no cloning/rollover. If a month opens empty, server backfill copies the last known set to preserve intent.
- **Storage balance & payouts**: Month-end cron locks current allocations (snapshots only), runs earnings, routes allocated vs unallocated funds, then payouts via Stripe Connect.
- **Platform fee**: 10% platform fee on earnings; keep fee config centralized.

## Collections (prod names; dev uses env-aware prefixes)
- `usdBalances`: per-user balance totals (`totalUsdCents`, `allocatedUsdCents`, `availableUsdCents`, `monthlyAllocationCents`, `lastAllocationDate`).
- `usdAllocations`: per-user/page allocations (`userId`, `recipientUserId`, `resourceId`, `resourceType`, `usdCents`, `month`, `status`).
- `writerUsdEarnings` / `writerUsdBalances`: earnings and rollups for creators.
- `userAllocationSnapshots`: month-end snapshots (read-only; do not drive live state).
- `unallocatedFundsReports`, `platformRevenue`, `monthlyEarningsReports`: reporting/ops.

## Allocation rules
- Persistent intent: user-set amounts remain until changed; month is for labeling only.
- No rollover/duplication: month-end lock does not modify live allocations.
- Backfill safety: if current month is empty, server auto-copies the latest month to keep intent; add monitoring around this if gaps appear.
- Only `status: 'active'` counts toward totals and earnings.
- Overspend allowed; unfunded portion is private to the allocator.

## Storage balance & payouts
- Month-end cron (`monthEndCronService`): lock (snapshot only) → earnings calc → use-it-or-lose-it → platform revenue → payout scheduling.
- Storage balance movement: allocated funds move; unallocated becomes platform revenue.
- Payouts: Stripe Connect; minimum threshold $25 (see payout troubleshooting for corner cases).

## Fees
- Platform fee: 10% of earnings. Keep fee config in code, not docs; audit that earnings calc uses the current fee.
- Payment processing fees are Stripe-standard and not part of the platform fee.

## Testing checklist (happy + edge)
1) New subscription → balance created/updated; allocations allowed; available math correct.
2) Allocation add/change/remove → balance updates; GET `/api/usd/allocations` reflects it.
3) Month-end dry run (`/api/cron/storage-balance-processing` dry-run): summary matches active allocations; no writes to live allocations.
4) Earnings calc uses only active allocations; platform fee applied.
5) Use-it-or-lose-it: unallocated routed to platform revenue; report saved.
6) Payouts: eligible creator paid via Connect; status transitions update.
7) Backfill: current month empty → backfill copies latest month once; log event.
8) Errors: card failures show user-friendly messages; retries/logging captured.

## Troubleshooting quick hits
- **Allocations missing at month start**: check backfill logs; if absent, confirm cron ran; data should auto-copy last month.
- **Balance mismatch**: recompute allocated via active `usdAllocations`; ensure `available = total - allocated`.
- **Card/payment errors**: Stripe error utility; see archived enhanced messaging doc for codes.
- **Payout shortfalls**: confirm platform fee rate and funded vs unfunded allocations; check Connect balance and fees.
- **Webhooks**: verify Stripe webhook logs; replay on failure; ensure idempotency keys.

## Admin/ops references
- Stripe dashboards: payments vs Connect balances; transfer groups per month.
- Feature flags: ensure payment/graph gating doesn’t block core flows.
- Reporting: use snapshots and `monthlyEarningsReports` for statements; live allocations are source of truth.

## Archived/legacy
- Archived: `ENHANCED_PAYMENT_ERROR_MESSAGING.md`, `PAYMENT_FAILURE_TRACKING.md`, `SETTINGS_PAYMENT_REORGANIZATION.md`, `PLATFORM_FEE_UPDATE_AUGUST_2025.md` (dated notice).
- Legacy overviews remain in `docs/archive` (demo balance, USD migration/overview/refactoring) for history only.
