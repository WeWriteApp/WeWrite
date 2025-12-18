# Firebase Migration Architecture

## Overview

This document describes the future-proof Firebase architecture implemented in WeWrite that enables migration from a single Firebase project with prefixed collection names to fully separate Firebase projects per environment.

## Current Architecture (Single Project with Prefixes)

### Environment Configuration
- **Local development**: `DEV_` prefixed collections (e.g., `DEV_users`, `DEV_pages`)
- **Vercel dev deployment**: `DEV_` prefixed collections
- **Vercel preview deployment**: `PROD_` prefixed collections  
- **Vercel production deployment**: Base collection names (e.g., `users`, `pages`)

### Collection Examples
```
Development:  DEV_users, DEV_pages, DEV_activities
Preview:      PROD_users, PROD_pages, PROD_activities  
Production:   users, pages, activities
```

## Future Architecture (Separate Projects)

### Environment Configuration
- **Local development**: Development Firebase project → base collection names
- **Vercel dev deployment**: Development Firebase project → base collection names
- **Vercel preview deployment**: Production Firebase project → base collection names
- **Vercel production deployment**: Production Firebase project → base collection names

### Collection Examples
```
Development Project:  users, pages, activities
Production Project:   users, pages, activities
```

## Implementation Components

### 1. Environment Detection System
**File**: `app/utils/environmentDetection.ts`

Provides reliable environment detection for both client and server contexts:
- Detects Vercel vs local environments
- Identifies deployment type (production/preview/development)
- Validates environment consistency
- Supports both current and future architectures

### 2. Environment-Aware Collection Helper
**File**: `app/utils/environmentConfig.ts`

Core functions for environment-specific collection naming:
- `getCollectionName(baseName)`: Returns environment-specific collection name
- `getSubCollectionPath()`: Handles subcollection paths with environment awareness
- `getFirebaseConfig()`: Returns appropriate Firebase configuration
- `validateEnvironmentConfig()`: Ensures proper environment separation

### 3. Environment-Aware Firebase Initializer
**File**: `app/firebase/environmentAwareConfig.ts`

Singleton Firebase app initializer that:
- Returns correct Firebase app instance based on environment
- Supports different Firebase config objects per environment
- Maintains backward compatibility during migration
- Provides type-safe service access

### 4. Migration Validator
**File**: `app/utils/firebaseMigrationValidator.ts`

Comprehensive validation system that:
- Validates environment configuration consistency
- Checks collection naming patterns
- Verifies migration prerequisites
- Generates migration documentation

## Usage Patterns

### Before (Direct Collection References)
```typescript
// ❌ Direct collection reference - not environment-aware
const usersRef = collection(db, "users");
const pageRef = doc(db, "pages", pageId);
```

### After (Environment-Aware References)
```typescript
// ✅ Environment-aware collection reference
import { getCollectionName } from '../utils/environmentConfig';

const usersRef = collection(db, getCollectionName("users"));
const pageRef = doc(db, getCollectionName("pages"), pageId);
```

### Firebase App Initialization
```typescript
// ✅ Environment-aware Firebase initialization
import { getEnvironmentAwareFirebase } from '../firebase/environmentAwareConfig';

const { app, db, auth } = getEnvironmentAwareFirebase();
```

## Migration Process

### Phase 1: Preparation (✅ Complete)
1. **Environment Detection System**: Centralized environment detection
2. **Collection Helpers**: Environment-aware collection naming functions
3. **Firebase Initializer**: Multi-project support with backward compatibility
4. **Code Refactoring**: Updated all direct collection references
5. **Validation System**: Comprehensive testing and validation tools

### Phase 2: Separate Projects Setup
1. **Create Firebase Projects**:
   - Development project for local and Vercel dev deployments
   - Production project for Vercel preview and production deployments

2. **Update Environment Variables**:
   ```bash
   # Development project
   NEXT_PUBLIC_FIREBASE_PID_DEV=wewrite-dev
   NEXT_PUBLIC_FIREBASE_API_KEY_DEV=...
   
   # Production project  
   NEXT_PUBLIC_FIREBASE_PID_PROD=wewrite-prod
   NEXT_PUBLIC_FIREBASE_API_KEY_PROD=...
   ```

3. **Update Firebase Configuration**:
   ```typescript
   export const getFirebaseConfig = (): FirebaseProjectConfig => {
     const envType = getEnvironmentType();
     
     switch (envType) {
       case 'production':
       case 'preview':
         return getProductionFirebaseConfig();
       case 'development':
         return getDevelopmentFirebaseConfig();
     }
   };
   ```

### Phase 3: Migration Execution
1. **Deploy Configuration**: Update Vercel environment settings
2. **Test Separation**: Validate data isolation between environments
3. **Data Migration**: Migrate existing data if needed (optional)
4. **Remove Prefixes**: Update collection helpers to return base names
5. **Cleanup**: Remove legacy prefixed collections

## Testing and Validation

### Debug API Endpoint
**URL**: `/api/debug/firebase-migration`

Provides comprehensive validation:
- Environment detection status
- Collection naming validation
- Migration readiness assessment
- Configuration testing

### Manual Testing
```typescript
import { runMigrationValidation } from '../utils/firebaseMigrationValidator';

// Run comprehensive validation
runMigrationValidation();
```

### Collection Mapping Verification
```typescript
import { getCollectionName, COLLECTIONS } from '../utils/environmentConfig';

// Verify all collections are properly mapped
Object.entries(COLLECTIONS).forEach(([key, baseName]) => {
  console.log(`${key}: ${baseName} → ${getCollectionName(baseName)}`);
});
```

## Benefits of This Architecture

### 1. **Seamless Migration**
- No code changes required during migration
- Configuration-only updates
- Backward compatibility maintained

### 2. **Environment Isolation**
- Complete data separation between environments
- No risk of production data contamination
- Safe testing and development

### 3. **Scalability**
- Supports multiple environments
- Easy to add new deployment targets
- Flexible configuration management

### 4. **Maintainability**
- Centralized environment logic
- Type-safe implementations
- Comprehensive validation

## Security Considerations

### Authentication Separation

#### Current Implementation
- **Development Environment**: Uses isolated mock authentication with test users
- **Production Environment**: Uses Firebase Authentication with real user accounts
- **Environment Variable**: `USE_DEV_AUTH=true` enables development auth isolation

#### Test Users (Development Only)
```typescript
// Available test users for development
testUser1: test1@wewrite.dev / testpass123
testUser2: test2@wewrite.dev / testpass123
testAdmin: admin@wewrite.dev / adminpass123 (admin privileges)
```

#### Data Separation
- **Development**: Uses `DEV_` prefixed collections with test users
- **Production**: Uses base collection names with real user accounts
- **Complete Isolation**: Development testing cannot affect production user data

### Current (Single Project)
- Relies on collection prefixes for separation
- Authentication separated by environment (dev uses mock auth)
- Access control through naming conventions and auth isolation

### Future (Separate Projects)
- Complete project-level isolation
- Separate authentication and security rules per project
- Independent access control per environment

## Rollback Strategy

If migration needs to be rolled back:
1. Revert Firebase configuration changes
2. Re-enable collection prefixing logic
3. Update environment variables
4. Validate collection access

The architecture is designed to support easy rollback with minimal code changes.

## Monitoring and Maintenance

### Environment Validation
- Automated validation in CI/CD pipeline
- Runtime environment checks
- Collection naming consistency verification

### Performance Monitoring
- Track Firebase usage per environment
- Monitor collection access patterns
- Validate data separation effectiveness

## Next Steps

1. **Review Implementation**: Validate all components are working correctly
2. **Setup Separate Projects**: Create development and production Firebase projects
3. **Update Configurations**: Implement project-specific configurations
4. **Test Migration**: Validate data separation and functionality
5. **Execute Migration**: Deploy to production with new architecture

## Related Documentation

- [Collection Naming Standards](./COLLECTION_NAMING_STANDARDS.md) - Collection naming conventions
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Environment configuration
- [Environment Architecture](./ENVIRONMENT_ARCHITECTURE.md) - Full environment details
- [Firebase Optimization Guide](./FIREBASE_OPTIMIZATION_GUIDE.md) - Optimization strategies
