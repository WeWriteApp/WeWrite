# WeWrite API Routes

88 API endpoints organized by feature domain using Next.js App Router conventions.

## Authentication

All protected routes use session-based authentication via Firebase:

```typescript
import { checkAdminPermissions } from '../admin-auth-helper';
import { getUserFromSession } from '../auth-helper';
```

## Route Categories

### Authentication (`/api/auth/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | User login |
| `/auth/logout` | POST | User logout |
| `/auth/register` | POST | User registration |
| `/auth/register-user` | POST | Full registration flow |
| `/auth/reset-password` | POST | Password reset |
| `/auth/session` | GET | Get current session |
| `/auth/sessions` | GET/DELETE | Manage sessions |
| `/auth/username` | GET/POST | Username operations |
| `/auth/verify-email` | POST | Email verification |
| `/auth/verify-email-token` | GET | Verify email token |
| `/auth/validate-session` | GET | Validate session |

### Admin (`/api/admin/*`)
| Endpoint | Purpose |
|----------|---------|
| `/admin/users` | User management |
| `/admin/dashboard-analytics` | KPI metrics |
| `/admin/monthly-financials` | Financial reports |
| `/admin/payouts` | Payout management |
| `/admin/payout-approval` | Approve payouts |
| `/admin/send-notification` | Send notifications |
| `/admin/trigger-cron` | Manual cron triggers |
| `/admin/feature-flags` | Feature flag management |
| `/admin/broadcast` | Broadcast messages |
| `/admin/email-logs` | Email history |

### Pages (`/api/pages/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/pages` | GET/POST | List/create pages |
| `/pages/[id]` | GET/PUT/DELETE | Page CRUD |
| `/pages/[id]/versions` | GET | Version history |
| `/pages/[id]/activities` | GET | Activity log |
| `/pages/[id]/sponsors` | GET | Page sponsors |
| `/pages/batch` | POST | Batch operations |
| `/pages/draft` | GET/POST | Draft management |
| `/pages/similar` | GET | Similar pages |
| `/pages/restore` | POST | Restore deleted |

### Users (`/api/users/*`)
| Endpoint | Purpose |
|----------|---------|
| `/users/[userId]/pages` | User's pages |
| `/users/[userId]/stats` | User statistics |
| `/users/[userId]/bio` | User bio |
| `/users/[userId]/donors` | User's donors |
| `/users/profile` | Profile management |
| `/users/username` | Username operations |
| `/users/batch` | Batch user data |

### Subscriptions (`/api/subscription/*`)
| Endpoint | Purpose |
|----------|---------|
| `/subscription/create-setup-intent` | Setup payment |
| `/subscription/create-simple` | Create subscription |
| `/subscription/cancel` | Cancel subscription |
| `/subscription/update` | Update subscription |
| `/subscription/portal` | Stripe portal |
| `/subscription/status` | Get status |
| `/subscription/reactivate` | Reactivate |

### USD Allocations (`/api/usd/*`)
| Endpoint | Purpose |
|----------|---------|
| `/usd/allocate` | Allocate to page |
| `/usd/allocate-user` | Allocate to user |
| `/usd/allocations` | Get allocations |
| `/usd/balance` | Get balance |
| `/usd/earnings` | Get earnings |
| `/usd/pending-allocations` | Pending allocations |
| `/usd/pledge-bar-data` | Pledge bar UI data |

### Payouts (`/api/payouts/*`)
| Endpoint | Purpose |
|----------|---------|
| `/payouts` | Payout operations |
| `/payouts/request` | Request payout |
| `/payouts/earnings` | Earnings data |
| `/payouts/history` | Payout history |
| `/payouts/history/csv` | Export CSV |
| `/payouts/setup` | Stripe Connect setup |
| `/payouts/preferences` | Payout preferences |

### Search (`/api/search*`)
| Endpoint | Purpose |
|----------|---------|
| `/search` | Main search |
| `/search-unified` | Unified search (Typesense + Firestore fallback) |
| `/search-users` | User search |
| `/search-keys` | Search API keys |

### Cron Jobs (`/api/cron/*`)
| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/cron/automated-payouts` | Monthly | Process payouts |
| `/cron/financial-reconciliation` | Daily | Reconcile balances |
| `/cron/weekly-digest` | Weekly | Send digest emails |
| `/cron/email-verification-reminder` | Daily | Verification reminders |
| `/cron/payout-setup-reminder` | Weekly | Payout setup reminders |
| `/cron/platform-balance-check` | Hourly | Monitor balances |

### Webhooks (`/api/webhooks/*`)
| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/webhooks/stripe-subscription` | Stripe | Subscription events |
| `/webhooks/stripe-payouts` | Stripe | Payout events |
| `/webhooks/resend` | Resend | Email events |

### Analytics (`/api/analytics/*`)
| Endpoint | Purpose |
|----------|---------|
| `/analytics/page-view` | Track page views |
| `/analytics/web-vitals` | Core Web Vitals |
| `/analytics/counters` | View counters |
| `/analytics/aggregations` | Data aggregations |

### Debug (`/api/debug/*`)
Development/debugging endpoints (protected):
- `/debug/auth-status` - Auth state
- `/debug/earnings-sources` - Earnings breakdown
- `/debug/environment` - Environment info
- `/debug/page/[id]` - Page debug data

## Helper Files

| File | Purpose |
|------|---------|
| `auth-helper.ts` | Authentication utilities |
| `admin-auth-helper.ts` | Admin permission checks |

## Response Format

All endpoints return consistent JSON responses:

```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message", code: "ERROR_CODE" }
```

## Related Documentation

- [Authentication](../../docs/auth/SESSION_MANAGEMENT_ARCHITECTURE.md)
- [Payments API](../../docs/payments/ALLOCATION_API_REFERENCE.md)
- [Cron Jobs](../../docs/deployment/CRON_JOB_SETUP.md)
- [Webhooks](../../docs/deployment/STRIPE_WEBHOOK_SETUP.md)
- [Services](../services/README.md)
- [App Directory](../README.md)
