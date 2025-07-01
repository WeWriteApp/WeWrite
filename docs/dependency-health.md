# Dependency Health Monitoring System

This document describes the comprehensive dependency health monitoring system implemented for the WeWrite project.

## Overview

The dependency health monitoring system provides automated tools to:
- Validate all import statements and dependencies
- Detect circular dependencies and import issues
- Generate dependency maps and visualizations
- Automatically fix common import path problems
- Monitor dependency health in CI/CD pipelines

## Available Commands

### Core Commands

```bash
# Run complete dependency audit
npm run deps:audit

# Check for dependency issues
npm run deps:check

# Validate all import statements
npm run deps:validate

# Generate dependency maps
npm run deps:map

# Fix import path issues
npm run deps:fix

# Run all dependency health checks
npm run deps:health
```

### Individual Tools

- `deps:check` - Comprehensive dependency analysis
- `deps:validate` - Import statement validation
- `deps:map` - Dependency visualization generation
- `deps:fix` - Automatic import path fixing

## Features

### 1. Dependency Health Check (`deps:check`)

**What it does:**
- Scans all TypeScript/JavaScript files in the project
- Identifies missing dependencies
- Detects unused dependencies
- Finds circular dependencies
- Validates TypeScript path mappings
- Identifies empty or invalid files

**Output:**
- Console report with categorized issues
- Recommendations for fixing each issue type
- Statistics on project health

### 2. Import Validation (`deps:validate`)

**What it does:**
- Validates all import and require statements
- Checks if imported files exist
- Validates external package dependencies
- Verifies TypeScript path mapping resolution

**Output:**
- Detailed validation report
- Line-by-line error reporting
- Success rate statistics

### 3. Dependency Map Generation (`deps:map`)

**What it does:**
- Builds complete dependency graph
- Identifies critical paths and heavily-used files
- Generates visual representations
- Analyzes circular dependencies

**Output:**
- `dependency-report.json` - Machine-readable report
- `dependency-report.txt` - Human-readable summary
- `dependency-map.mermaid` - Mermaid diagram
- `dependency-map.dot` - Graphviz diagram

### 4. Import Path Fixing (`deps:fix`)

**What it does:**
- Automatically fixes broken relative imports
- Converts deep relative imports to absolute paths
- Removes unused imports
- Standardizes import path conventions

**Options:**
- `--dry-run` - Preview changes without applying them

## Integration Points

### Pre-commit Hooks

The system integrates with Husky pre-commit hooks to:
- Run dependency validation before commits
- Prevent commits with broken imports
- Ensure code quality standards

### GitHub Actions

Automated workflows run on:
- Every push to main/dev branches
- Pull requests
- Daily scheduled runs

**Workflow features:**
- Comprehensive dependency analysis
- Artifact generation for reports
- PR comments with issue summaries
- Security audits and license checks

### ESLint Integration

Enhanced ESLint configuration includes:
- Import/export validation rules
- Circular dependency detection
- Unused import warnings
- Import ordering and organization

## Configuration

### TypeScript Path Mapping

The system respects `tsconfig.json` path mappings:

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

### ESLint Rules

Key ESLint rules for dependency health:

```json
{
  "rules": {
    "import/no-unresolved": "error",
    "import/no-cycle": "error",
    "import/no-unused-modules": "warn",
    "import/order": ["warn", { /* ordering config */ }]
  }
}
```

## Best Practices

### Import Organization

1. **Group imports by type:**
   - Built-in Node.js modules
   - External packages
   - Internal modules (using @/ paths)
   - Relative imports

2. **Use absolute imports for deep paths:**
   ```typescript
   // Good
   import { Button } from '@/components/ui/button';
   
   // Avoid
   import { Button } from '../../../components/ui/button';
   ```

3. **Keep imports organized:**
   - Alphabetical ordering within groups
   - Consistent spacing between groups

### Dependency Management

1. **Regular audits:**
   - Run `npm run deps:audit` weekly
   - Address circular dependencies promptly
   - Remove unused dependencies

2. **Import validation:**
   - Fix broken imports immediately
   - Use TypeScript path mappings consistently
   - Avoid deep relative imports

3. **Monitoring:**
   - Review dependency reports in CI/CD
   - Monitor for new circular dependencies
   - Keep dependency maps up to date

## Troubleshooting

### Common Issues

**Circular Dependencies:**
- Review the dependency chain
- Extract shared logic to separate modules
- Use dependency injection patterns

**Missing Dependencies:**
- Install missing packages: `npm install <package>`
- Check for typos in import statements
- Verify package names and versions

**Broken Imports:**
- Run `npm run deps:fix` for automatic fixes
- Check file paths and extensions
- Verify TypeScript path mappings

**Performance Issues:**
- Large dependency graphs may slow analysis
- Use `.gitignore` patterns to exclude unnecessary files
- Consider breaking large modules into smaller ones

### Getting Help

1. Check the console output for detailed error messages
2. Review generated reports in the project root
3. Use `--dry-run` flags to preview changes
4. Check GitHub Actions logs for CI/CD issues

## Maintenance

### Regular Tasks

- **Weekly:** Run full dependency audit
- **Monthly:** Review and update dependency maps
- **Quarterly:** Analyze circular dependencies and refactor

### Updates

The dependency health system should be updated when:
- New major dependencies are added
- Project structure changes significantly
- TypeScript configuration is modified
- Build tools are updated

## Files and Directories

```
scripts/
├── dependency-health-check.js    # Main health check tool
├── validate-imports.js           # Import validation
├── generate-dependency-map.js    # Dependency mapping
└── fix-import-paths.js          # Automatic fixing

.github/workflows/
└── dependency-health.yml        # CI/CD workflow

docs/
└── dependency-health.md         # This documentation

Generated files:
├── dependency-report.json       # Machine-readable report
├── dependency-report.txt        # Human-readable report
├── dependency-map.mermaid       # Mermaid diagram
└── dependency-map.dot          # Graphviz diagram
```
