# Persistent Monthly Allocation Model

## Overview

Allocations on WeWrite are **persistent monthly commitments**: what a supporter sets stays in effect every month until they change it. We keep a month field for reporting and payouts, but we do **not** require end-of-month duplication or “rollover” to preserve intent. If a month opens empty because a cron failed, we backfill from the latest known allocation set to keep continuity.

## Core Principles

- **Set-and-stay**: A supporter’s chosen amounts apply every month until they actively adjust them.
- **No additive rollovers**: We don’t stack months or re-create records; the allocation state is treated as the source of truth for every month.
- **Reporting-friendly**: We still tag allocations with `month` for statements, analytics, and locking, but that tag doesn’t reset the user’s plan.
- **Resilience**: If the current month is missing records, we materialize them from the last known state so creators don’t see a sudden drop.

## Data Shape
```typescript
{
  userId: "supporter_id",
  recipientUserId: "writer_id",
  resourceId: "page_id",
  usdCents: 500,            // $5.00 allocation
  month: "2024-01",         // Reporting/payout month
  status: "active",         // active | locked | processed
  // rolledOverFrom removed — persistence is the default behavior
}
```

## Month Handling

- **Active months**: Use the supporter’s latest saved allocations.
- **Month-end**: We lock the month for payouts/earnings, but that lock does **not** clear or reset the supporter’s plan.
- **Current month gaps**: If we detect no active allocations for the current month, we backfill from the latest month to preserve the supporter’s intent.

## User Experience

- Supporters set allocations once; they continue automatically each month until edited.
- Creators see predictable income because allocation intent persists.
- Adjustments are explicit: users choose to increase, decrease, or remove allocations—no silent resets.

## Operational Notes

- Remove any workflows that rely on copying allocations month-to-month; treat the saved allocation set as canonical.
- Month-scoped queries remain for analytics, payout timing, and locking, but should never wipe or zero a user’s plan.
- Backfill behavior is a safety net for missing current-month records, not a rollover mechanic.

## Monitoring

- Track gaps where current-month allocations had to be backfilled (indicates cron/lock issues).
- Track allocation stability (changes per user per month) to ensure persistence is behaving as expected.
