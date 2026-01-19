# WeWrite - Claude Code Instructions

This file contains project-specific instructions for Claude Code.

## Documentation Maintenance Requirements

When making significant changes to the codebase, you MUST update the following:

### 1. System Architecture Diagram (`app/admin/system-diagram/SystemDiagramFlow.tsx`)
- Update `NODE_DETAILS` when adding/removing/renaming:
  - Service files (`app/services/`)
  - API routes (`app/api/`)
  - Hooks (`app/hooks/`)
  - Major components or contexts
- Ensure all file paths are accurate and exist in the codebase
- Update upstream/downstream relationships when data flow changes

### 2. Architecture Documentation (`docs/architecture/CURRENT_ARCHITECTURE.md`)
- Update when architectural patterns change
- Update when new major features are added
- Update when the tech stack changes

### 3. Other Documentation (when relevant)
- `docs/payments/` - Payment and subscription system changes
- `docs/firebase/` - Firebase/database changes
- `docs/ui/` - UI system and design changes
- `docs/features/` - Feature-specific documentation

## Code Quality Reminders

1. **No fake file paths**: Always verify file paths exist before referencing them
2. **Keep docs in sync**: Documentation debt is real - update docs with code changes
3. **Admin pages**: Use real data, not mocked data, in admin dashboards

## Key Files to Know

- **System Diagram**: `app/admin/system-diagram/SystemDiagramFlow.tsx`
- **Design System**: `app/design-system/page.tsx`
- **Icon System**: `app/components/ui/Icon.tsx` (uses Lucide icons)
- **Theme System**: `app/components/utils/ThemeModal.tsx`
- **Financial Services**: `app/services/earningsCalculationEngine.ts`, `app/services/platformRevenueService.ts`
