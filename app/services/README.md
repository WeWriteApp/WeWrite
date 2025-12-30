# WeWrite Services

Business logic layer containing 70 services that handle core application functionality.

## Service Categories

### Payments & Payouts
| Service | Purpose |
|---------|---------|
| `payoutService.ts` | Core payout processing |
| `automatedPayoutService.ts` | Scheduled automatic payouts |
| `payoutSchedulerService.ts` | Payout scheduling logic |
| `payoutRetryService.ts` | Failed payout retry handling |
| `payoutStatusService.ts` | Payout status tracking |
| `payoutMonitoringService.ts` | Payout health monitoring |
| `payoutNotificationService.ts` | Payout email notifications |
| `payoutErrorLogger.ts` | Payout error tracking |
| `payoutLimitService.ts` | Payout limits and thresholds |
| `paymentRecoveryService.ts` | Failed payment recovery |
| `paymentAnalytics.ts` | Payment metrics |

### Earnings & Allocations
| Service | Purpose |
|---------|---------|
| `earningsCalculationEngine.ts` | Core earnings calculations |
| `earningsVisualizationService.ts` | Earnings chart data |
| `usdService.ts` | USD balance management |
| `usdDataService.ts` | USD data queries |
| `usdEarningsService.ts` | USD earnings processing |
| `useItOrLoseItService.ts` | Unallocated funds handling |
| `pledgeBudgetService.ts` | Pledge budget validation |
| `pledgeStatsService.ts` | Pledge statistics |

### Financial Operations
| Service | Purpose |
|---------|---------|
| `financialOperationsService.ts` | High-level financial operations |
| `financialReconciliationService.ts` | Balance reconciliation |
| `financialValidationService.ts` | Financial data validation |
| `feeService.ts` | Fee calculations |
| `feeConfigurationService.ts` | Fee configuration |
| `unifiedFeeCalculationService.ts` | Consolidated fee logic |
| `platformRevenueService.ts` | Platform revenue tracking |
| `platformFeeAnalytics.ts` | Platform fee analytics |
| `platformBalanceMonitoringService.ts` | Balance alerts |
| `platformAccountConfigService.ts` | Platform account setup |
| `stripeStorageBalanceService.ts` | Stripe balance storage |
| `storageBalanceMigrationService.ts` | Balance migration |

### Email & Notifications
| Service | Purpose |
|---------|---------|
| `emailService.ts` | Core email sending (Resend) |
| `emailLogService.ts` | Email logging and tracking |
| `emailSettingsTokenService.ts` | Email preferences tokens |
| `emailVerificationNotifications.ts` | Verification emails |
| `notificationsService.ts` | In-app notifications |
| `usernameNotificationService.ts` | Username-related notifications |

### Subscriptions
| Service | Purpose |
|---------|---------|
| `subscriptionAnalyticsService.ts` | Subscription metrics |
| `subscriptionAuditService.ts` | Subscription auditing |
| `subscriptionValidationService.ts` | Subscription validation |
| `embeddedCheckoutService.ts` | Stripe embedded checkout |

### Analytics & Tracking
| Service | Purpose |
|---------|---------|
| `adminAnalytics.ts` | Admin dashboard analytics |
| `analyticsAggregation.ts` | Analytics data aggregation |
| `transactionTrackingService.ts` | Transaction tracking |
| `VisitorTrackingService.ts` | Visitor analytics |
| `VisitorValidationService.ts` | Bot detection |
| `BotDetectionService.ts` | Bot traffic filtering |
| `StatsService.ts` | General statistics |
| `LiveReadersService.ts` | Real-time reader count |
| `pwaInstallTracking.ts` | PWA install tracking |
| `sharesTracking.ts` | Content share tracking |

### User & Content
| Service | Purpose |
|---------|---------|
| `ContributorsService.ts` | Page contributor data |
| `userDonorAnalytics.ts` | Donor analytics |
| `linkSuggestionService.ts` | Link suggestions |
| `linkMentionService.ts` | @ mentions |
| `pageLinkService.ts` | Page link management |
| `versionService.ts` | Version history |

### Tax & Compliance
| Service | Purpose |
|---------|---------|
| `taxInformationService.ts` | Tax form collection |
| `taxReportingService.ts` | Tax report generation |

### Admin & System
| Service | Purpose |
|---------|---------|
| `adminClaimsService.ts` | Admin permissions |
| `auditTrailService.ts` | Action logging |
| `balanceMonitoringService.ts` | Balance alerts |
| `monthEndCronService.ts` | Month-end processing |
| `monthlyAllocationLockService.ts` | Allocation locking |
| `scheduledReconciliationService.ts` | Scheduled reconciliation |
| `webhookIdempotencyService.ts` | Webhook deduplication |

### Migration & Maintenance
| Service | Purpose |
|---------|---------|
| `executeMigrationService.ts` | Database migrations |
| `systemMigrationService.ts` | System migrations |
| `historicalFundMigrationService.ts` | Historical data migration |
| `resendContactsService.ts` | Resend contact sync |

## Architecture Patterns

### Service Classes
Most services export a class with static methods:

```typescript
export class PayoutService {
  static async processPayout(userId: string): Promise<PayoutResult> {
    // Implementation
  }
}
```

### Firebase Admin
Services use Firebase Admin SDK for server-side operations:

```typescript
import { adminDb } from '@/app/firebase/admin';
const doc = await adminDb.collection('users').doc(userId).get();
```

### Stripe Integration
Payment services integrate with Stripe:

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

## Related Documentation

- [Payments & Allocations](../../docs/payments/PAYMENTS_AND_ALLOCATIONS.md)
- [Payout Troubleshooting](../../docs/payments/PAYOUT_TROUBLESHOOTING_GUIDE.md)
- [Email System](../../docs/features/EMAIL_SYSTEM_IMPLEMENTATION.md)
- [Firebase Patterns](../../docs/firebase/FIREBASE_OPTIMIZATION_GUIDE.md)
- [App Directory](../README.md)
- [API Routes](../api/README.md)
