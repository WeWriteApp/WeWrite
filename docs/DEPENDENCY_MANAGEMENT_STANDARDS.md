# Dependency Management Standards

This document establishes comprehensive standards for dependency management in the WeWrite project to ensure consistency, maintainability, and reliability.

## Import Path Conventions

### 1. Absolute vs Relative Imports

**Use absolute imports (@/) for:**
- Cross-directory imports (more than 2 levels up)
- Commonly used utilities and services
- UI components from other directories
- Firebase and database modules

```typescript
// ✅ Good - Use absolute imports
import { Button } from '@/components/ui/button';
import { database } from '@/firebase/database';
import { formatDate } from '@/utils/dateUtils';

// ❌ Avoid - Deep relative imports
import { Button } from '../../../components/ui/button';
import { database } from '../../../firebase/database';
```

**Use relative imports for:**
- Files in the same directory
- Direct parent/child relationships
- Closely related components

```typescript
// ✅ Good - Use relative imports for same directory
import { UserBadge } from './UserBadge';
import { PageHeader } from '../PageHeader';

// ❌ Avoid - Absolute imports for same directory
import { UserBadge } from '@/components/pages/UserBadge';
```

### 2. Import Ordering

Organize imports in the following order with blank lines between groups:

```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Search } from 'lucide-react';

// 2. Internal absolute imports (@/)
import { Button } from '@/components/ui/button';
import { database } from '@/firebase/database';
import { useAuth } from '@/hooks/useAuth';

// 3. Relative imports
import { UserBadge } from './UserBadge';
import './styles.css';
```

### 3. TypeScript Path Mappings

Current path mappings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./app/*"]
    }
  }
}
```

**Standard prefixes:**
- `@/components/*` - UI components and layouts
- `@/utils/*` - Utility functions and helpers
- `@/hooks/*` - Custom React hooks
- `@/services/*` - Business logic and API services
- `@/firebase/*` - Firebase configuration and database
- `@/providers/*` - React context providers
- `@/types/*` - TypeScript type definitions

## Component Organization Structure

### Directory Structure

```
app/
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── modal.tsx
│   ├── layout/            # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── features/          # Feature-specific components
│   │   ├── Dashboard.tsx
│   │   ├── TrendingPages.tsx
│   │   └── RecentActivity.tsx
│   ├── pages/             # Page-specific components
│   │   ├── PageHeader.tsx
│   │   ├── PageMetadata.tsx
│   │   └── SinglePageView.tsx
│   └── utils/             # Component utilities
│       ├── PillLink.tsx
│       └── Loader.tsx
├── hooks/                 # Custom React hooks
├── services/              # Business logic services
├── utils/                 # General utilities
├── firebase/              # Firebase configuration
├── providers/             # React context providers
└── types/                 # TypeScript definitions
```

### File Naming Conventions

**Components:**
- Use PascalCase for component files: `UserProfile.tsx`
- Use kebab-case for utility files: `date-utils.ts`
- Use camelCase for hooks: `useAuth.ts`

**Exports:**
- Use named exports for utilities and hooks
- Use default exports for React components
- Create index files for barrel exports when appropriate

```typescript
// ✅ Good - Component with default export
export default function UserProfile() {
  return <div>Profile</div>;
}

// ✅ Good - Utility with named exports
export const formatDate = (date: Date) => { /* */ };
export const parseDate = (str: string) => { /* */ };

// ✅ Good - Barrel export (index.ts)
export { formatDate, parseDate } from './date-utils';
export { validateEmail } from './validation-utils';
```

## Dependency Management Rules

### 1. Package Installation

**Always use pnpm for consistency:**
```bash
# ✅ Install production dependencies
pnpm add package-name

# ✅ Install development dependencies
pnpm add --save-dev package-name

# ❌ Don't mix package managers
npm install package-name  # Avoid
yarn add package-name     # Avoid
```

**Version Management:**
- Pin exact versions for critical dependencies
- Use caret ranges (^) for most packages
- Use tilde ranges (~) for patch-level updates only

```json
{
  "dependencies": {
    "react": "18.2.0",           // Exact version for critical
    "next": "^14.0.0",           // Caret for minor updates
    "lodash": "~4.17.21"         // Tilde for patch only
  }
}
```

### 2. Dependency Categories

**Production Dependencies:**
- Core framework packages (React, Next.js)
- UI libraries and components
- Database and authentication
- Runtime utilities

**Development Dependencies:**
- Build tools and bundlers
- Testing frameworks
- Linting and formatting
- Type definitions

**Avoid Installing:**
- Packages with known security vulnerabilities
- Unmaintained packages (no updates > 2 years)
- Packages with excessive dependencies
- Duplicate functionality packages

### 3. Regular Maintenance

**Weekly Tasks:**
- Run `pnpm run deps:audit` to check health
- Review and update outdated packages
- Remove unused dependencies

**Monthly Tasks:**
- Update major dependencies (with testing)
- Review security advisories
- Optimize bundle size

## Automated Tools and Scripts

### Available Commands

```bash
# Health monitoring
pnpm run deps:check          # Comprehensive dependency analysis
pnpm run deps:validate       # Validate all import statements
pnpm run deps:map           # Generate dependency visualizations
pnpm run deps:dashboard     # Create interactive dashboard

# Fixing and maintenance
pnpm run deps:fix           # Automatically fix import paths
pnpm run deps:heal          # Self-healing dependency system
pnpm run deps:heal:plan     # Preview healing actions

# Testing and validation
pnpm run deps:test          # Test dependency system
pnpm run deps:audit         # Complete dependency audit
pnpm run deps:health        # Full health check with dashboard
```

### Pre-commit Hooks

Husky pre-commit hook automatically runs:
1. Dependency validation (`pnpm run deps:validate`)
2. ESLint checks (`pnpm run lint`)
3. TypeScript compilation (`pnpm dlx tsc --noEmit`)

### CI/CD Integration

GitHub Actions workflow runs on every push:
- Dependency health checks
- Import validation
- Security audits
- Bundle size analysis

## Error Prevention

### 1. ESLint Configuration

Enhanced ESLint rules for import management:

```json
{
  "rules": {
    "import/no-unresolved": "error",
    "import/no-cycle": "error",
    "import/no-unused-modules": "warn",
    "import/order": ["warn", {
      "groups": ["builtin", "external", "internal", "parent", "sibling"],
      "newlines-between": "always"
    }]
  }
}
```

### 2. TypeScript Configuration

Strict TypeScript settings to catch import issues:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true
  }
}
```

### 3. IDE Configuration

**VS Code settings for consistency:**

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "typescript.suggest.paths": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll.eslint": true
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

**1. Circular Dependencies**
```bash
# Identify circular dependencies
pnpm run deps:check

# Common causes:
# - Mutual imports between components
# - Service layer circular references
# - Context provider loops

# Solutions:
# - Extract shared logic to separate modules
# - Use dependency injection patterns
# - Implement proper layered architecture
```

**2. Missing Dependencies**
```bash
# Auto-install missing dependencies
pnpm run deps:heal

# Manual installation
pnpm add missing-package-name
```

**3. Broken Import Paths**
```bash
# Auto-fix import paths
pnpm run deps:fix

# Manual fixes:
# - Update relative paths to absolute (@/)
# - Fix typos in import statements
# - Ensure file extensions are correct
```

**4. Bundle Size Issues**
```bash
# Analyze bundle size
pnpm run analyze:bundle

# Remove unused dependencies
pnpm run deps:heal

# Use tree-shaking friendly imports
import { specific } from 'library';  // ✅ Good
import * as library from 'library';  // ❌ Avoid
```

## Best Practices Summary

1. **Use absolute imports (@/) for cross-directory references**
2. **Organize imports by external → internal → relative**
3. **Follow consistent file naming conventions**
4. **Run dependency health checks weekly**
5. **Keep dependencies up to date and secure**
6. **Use automated tools for import path management**
7. **Implement proper error handling and validation**
8. **Document any deviations from standards**

## Enforcement

These standards are enforced through:
- Pre-commit hooks (Husky)
- CI/CD pipeline checks (GitHub Actions)
- ESLint and TypeScript configuration
- Automated dependency monitoring
- Regular team code reviews

For questions or exceptions to these standards, please discuss with the development team and update this document accordingly.
