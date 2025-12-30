# WeWrite Documentation

## Quick Start

```bash
bun install && bun dev
```

**Tech Stack**: Next.js 15, TypeScript, TanStack Query v5, Firebase, Tailwind CSS

---

## Code Documentation

These READMEs live alongside the code they document:

| README | Contents |
|--------|----------|
| [/README.md](../README.md) | Project overview, setup, tech stack |
| [/app/README.md](../app/README.md) | App directory structure, routes, key files |
| [/app/api/README.md](../app/api/README.md) | 88 API endpoints by category |
| [/app/services/README.md](../app/services/README.md) | 70 business logic services |

---

## Documentation by Category

### Core Architecture
| Doc | Description |
|-----|-------------|
| [CURRENT_ARCHITECTURE](./architecture/CURRENT_ARCHITECTURE.md) | System overview |
| [ENVIRONMENT_QUICK_REFERENCE](./architecture/ENVIRONMENT_QUICK_REFERENCE.md) | Dev/preview/prod behavior |
| [PAGE_DATA_AND_VERSIONS](./architecture/PAGE_DATA_AND_VERSIONS.md) | Page data structures |
| [USER_DATA_FETCHING_PATTERNS](./architecture/USER_DATA_FETCHING_PATTERNS.md) | Data fetching patterns |

### Authentication & Sessions
| Doc | Description |
|-----|-------------|
| [FIREBASE_REST_API_ARCHITECTURE](./firebase/FIREBASE_REST_API_ARCHITECTURE.md) | **Start here for auth** - Hybrid REST/Admin |
| [AUTHENTICATION_ARCHITECTURE](./firebase/AUTHENTICATION_ARCHITECTURE.md) | Environment-specific auth |
| [SESSION_MANAGEMENT_ARCHITECTURE](./auth/SESSION_MANAGEMENT_ARCHITECTURE.md) | Session handling |
| [ADMIN_ACCOUNT_SETUP](./auth/ADMIN_ACCOUNT_SETUP.md) | Admin setup |

### Payments & Allocations
| Doc | Description |
|-----|-------------|
| [PAYMENTS_AND_ALLOCATIONS](./payments/PAYMENTS_AND_ALLOCATIONS.md) | **Main payments doc** - subscriptions, allocations, payouts |
| [ALLOCATION_SYSTEM](./payments/ALLOCATION_SYSTEM.md) | Allocation architecture |
| [ALLOCATION_API_REFERENCE](./payments/ALLOCATION_API_REFERENCE.md) | API reference |
| [PAYOUT_TROUBLESHOOTING_GUIDE](./payments/PAYOUT_TROUBLESHOOTING_GUIDE.md) | Common issues |

### Search System
| Doc | Description |
|-----|-------------|
| [SEARCH_SYSTEM](./search/SEARCH_SYSTEM.md) | Search architecture |
| [SEARCH_PERFORMANCE_OPTIMIZATIONS](./search/SEARCH_PERFORMANCE_OPTIMIZATIONS.md) | Performance tuning |
| [SEARCH_ALGORITHM_CHANGELOG](./search/SEARCH_ALGORITHM_CHANGELOG.md) | Algorithm changes |

### UI & Design
| Doc | Description |
|-----|-------------|
| [HEADER_SYSTEM](./ui/HEADER_SYSTEM.md) | Header components |
| [BANNER_SYSTEM_GUIDE](./ui/BANNER_SYSTEM_GUIDE.md) | Notification banners |
| [DESIGN_SYSTEM_ARCHITECTURE](./ui/DESIGN_SYSTEM_ARCHITECTURE.md) | Cards, overlays, glassmorphism |
| [THEME_SYSTEM_ARCHITECTURE](./ui/THEME_SYSTEM_ARCHITECTURE.md) | Theming |
| [COMPLETE_COLOR_SYSTEM](./ui/COMPLETE_COLOR_SYSTEM.md) | Color tokens |

### Editor
| Doc | Description |
|-----|-------------|
| [TEXT_SELECTION_AND_ATTRIBUTION](./editor/TEXT_SELECTION_AND_ATTRIBUTION.md) | Selection & attribution |
| [LINK_SUGGESTION_SYSTEM](./editor/LINK_SUGGESTION_SYSTEM.md) | Link suggestions |
| [DIFF_SYSTEM](./editor/DIFF_SYSTEM.md) | Diffing system |

### Features
| Doc | Description |
|-----|-------------|
| [NOTIFICATION_SYSTEM](./features/NOTIFICATION_SYSTEM.md) | Notification types |
| [EMAIL_SYSTEM_IMPLEMENTATION](./features/EMAIL_SYSTEM_IMPLEMENTATION.md) | Email templates |
| [LEADERBOARD_SYSTEM](./features/LEADERBOARD_SYSTEM.md) | Leaderboard |
| [RECENT_EDITS_SYSTEM](./features/RECENT_EDITS_SYSTEM.md) | Recent activity |

### Firebase
| Doc | Description |
|-----|-------------|
| [FIREBASE_OPTIMIZATION_GUIDE](./firebase/FIREBASE_OPTIMIZATION_GUIDE.md) | Performance/cost |
| [COLLECTION_NAMING_STANDARDS](./firebase/COLLECTION_NAMING_STANDARDS.md) | Data layout |
| [MIGRATION_GUIDE](./firebase/MIGRATION_GUIDE.md) | Migration guide |

### Performance & Logging
| Doc | Description |
|-----|-------------|
| [PERFORMANCE_OPTIMIZATION_GUIDE](./performance/PERFORMANCE_OPTIMIZATION_GUIDE.md) | Performance |
| [LOGGING_NOISE_REDUCTION](./performance/LOGGING_NOISE_REDUCTION.md) | Log management |
| [IMMEDIATE_UPDATES](./performance/IMMEDIATE_UPDATES.md) | Save timing |

### Deployment
| Doc | Description |
|-----|-------------|
| [VERCEL_DEPLOYMENT](./deployment/VERCEL_DEPLOYMENT.md) | Deployment |
| [CRON_JOB_SETUP](./deployment/CRON_JOB_SETUP.md) | Scheduled jobs |
| [STRIPE_WEBHOOK_SETUP](./deployment/STRIPE_WEBHOOK_SETUP.md) | Webhooks |

### Security
| Doc | Description |
|-----|-------------|
| [SECURITY_AUDIT_REPORT](./security/SECURITY_AUDIT_REPORT.md) | Security posture |
| [USERNAME_SECURITY_GUIDELINES](./security/USERNAME_SECURITY_GUIDELINES.md) | Identity security |

### Maintenance
| Doc | Description |
|-----|-------------|
| [DEPENDENCY_MANAGEMENT_STANDARDS](./maintenance/DEPENDENCY_MANAGEMENT_STANDARDS.md) | Dependencies |
| [LEGACY_CODE_CLEANUP_GUIDE](./maintenance/LEGACY_CODE_CLEANUP_GUIDE.md) | Cleanup patterns |
| [RECENT_CHANGES_SUMMARY](./maintenance/RECENT_CHANGES_SUMMARY.md) | Recent changes |

### Legal
| Doc | Description |
|-----|-------------|
| [Privacy Policy](./legal/PRIVACY_POLICY.md) | Privacy |
| [Terms of Service](./legal/TERMS_OF_SERVICE.md) | Terms |

### Archive
Historical docs for completed migrations and deprecated systems: `archive/`

---

## Folder Structure

```
docs/
├── architecture/    # System architecture (11 docs)
├── auth/            # Authentication & sessions (2 docs)
├── deployment/      # Deployment & ops (9 docs)
├── editor/          # Editor features (11 docs)
├── features/        # Feature systems (8 docs)
├── firebase/        # Firebase patterns (8 docs)
├── legal/           # Legal documents (2 docs)
├── maintenance/     # Code maintenance (10 docs)
├── payments/        # Payments & allocations (21 docs)
├── performance/     # Performance & logging (6 docs)
├── search/          # Search system (6 docs)
├── security/        # Security (7 docs)
├── ui/              # UI & design (22 docs)
└── archive/         # Historical docs
```

---

## Development

```bash
bun dev          # Start dev server
bun build        # Production build
bun test         # Run tests
bun test:watch   # Watch mode
```

## License

Proprietary software. All rights reserved.
