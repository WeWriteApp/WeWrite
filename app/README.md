# WeWrite App Directory

This is the main Next.js 15 application directory using the App Router.

## Directory Structure

```
app/
├── [id]/              # Dynamic page routes (view, edit, versions, activity)
├── admin/             # Admin dashboard pages (24 pages)
├── api/               # API routes (88 endpoints) - see api/README.md
├── auth/              # Authentication pages (login, register, verify)
├── components/        # React components (46 subdirectories)
├── config/            # App configuration (social links, feature flags)
├── constants/         # Shared constants
├── contexts/          # React contexts (22 contexts)
├── firebase/          # Firebase client-side integration
├── hooks/             # Custom React hooks (53 hooks)
├── lib/               # Utility libraries (rate limiting, validation)
├── middleware/        # Next.js middleware
├── providers/         # React providers (auth, theme, query)
├── services/          # Business logic services (70 services) - see services/README.md
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout with providers, analytics, PWA setup |
| `page.tsx` | Landing page |
| `globals.css` | Global styles (161KB - includes Tailwind + custom) |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |

## Route Groups

### Public Pages
- `/` - Landing page
- `/[id]` - View page by ID
- `/auth/*` - Login, register, forgot password, verify email
- `/leaderboard` - Top contributors
- `/search` - Search pages
- `/trending` - Trending content

### Protected Pages
- `/home` - User home feed
- `/create`, `/new` - Create new page
- `/settings/*` - User settings (profile, subscription, earnings)
- `/notifications` - User notifications
- `/following` - Followed users/pages

### Admin Pages (`/admin/*`)
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/product-kpis` - Product analytics
- `/admin/monthly-financials` - Financial reports
- `/admin/system-diagram` - Architecture visualization

## Key Subdirectories

### [services/](./services/README.md)
Business logic layer with 70 services covering:
- Payments & payouts
- Email & notifications
- Analytics & tracking
- Financial operations

### [api/](./api/README.md)
88 API endpoints organized by feature domain.

### components/
UI components organized by feature:
- `admin/` - Admin-specific components
- `editor/` - Rich text editor components
- `layout/` - Layout components (Header, Footer, Sidebar)
- `pages/` - Page-related components
- `ui/` - Design system primitives
- `utils/` - Utility components (modals, toasts)

### contexts/
React contexts for global state:
- `AuthContext` - Authentication state
- `PageContext` - Current page data
- `EditorContext` - Editor state
- `ThemeContext` - Theme preferences
- `SubscriptionContext` - User subscription

### hooks/
53 custom hooks for:
- Data fetching (`usePages`, `useUser`, `useSearch`)
- UI state (`useDebounce`, `useLocalStorage`)
- Business logic (`useSubscription`, `useEarnings`)
- Analytics (`useDashboardAnalytics`)

## Related Documentation

- [Architecture Overview](../docs/architecture/CURRENT_ARCHITECTURE.md)
- [Firebase Patterns](../docs/firebase/FIREBASE_OPTIMIZATION_GUIDE.md)
- [UI Design System](../docs/ui/DESIGN_SYSTEM_ARCHITECTURE.md)
- [API Routes](./api/README.md)
- [Services](./services/README.md)
