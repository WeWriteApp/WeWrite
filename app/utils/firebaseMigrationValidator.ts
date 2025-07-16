/**
 * Firebase Migration Validator
 * 
 * This utility validates the current Firebase architecture and ensures
 * it's properly prepared for migration from single project with prefixed
 * collections to separate Firebase projects per environment.
 */

import { getEnvironmentType, getCollectionName, validateEnvironmentConfig, COLLECTIONS } from './environmentConfig';
import { getEnvironmentContext, validateEnvironmentDetection } from './environmentDetection';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Collection usage validation result
 */
export interface CollectionValidationResult {
  collectionName: string;
  baseCollectionName: string;
  environmentSpecificName: string;
  isCorrectlyPrefixed: boolean;
  expectedPrefix: string;
  actualPrefix: string;
}

/**
 * Validate environment configuration for Firebase migration readiness
 */
export const validateMigrationReadiness = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Validate environment detection
  const envDetection = validateEnvironmentDetection();
  if (!envDetection.isValid) {
    errors.push('Environment detection validation failed');
    errors.push(...envDetection.warnings);
  } else if (envDetection.warnings.length > 0) {
    warnings.push(...envDetection.warnings);
  }
  
  // Validate environment configuration
  const envConfigValid = validateEnvironmentConfig();
  if (!envConfigValid) {
    errors.push('Environment configuration validation failed');
  }
  
  // Validate collection naming consistency
  const collectionValidation = validateCollectionNaming();
  if (!collectionValidation.isValid) {
    errors.push('Collection naming validation failed');
    errors.push(...collectionValidation.errors);
  }
  warnings.push(...collectionValidation.warnings);
  recommendations.push(...collectionValidation.recommendations);
  
  // Check for migration readiness
  const migrationChecks = validateMigrationPrerequisites();
  if (!migrationChecks.isValid) {
    errors.push('Migration prerequisites not met');
    errors.push(...migrationChecks.errors);
  }
  warnings.push(...migrationChecks.warnings);
  recommendations.push(...migrationChecks.recommendations);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
};

/**
 * Validate collection naming consistency
 */
export const validateCollectionNaming = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  const envType = getEnvironmentType();
  const expectedPrefix = getExpectedPrefix(envType);
  
  // Validate all defined collections
  const collectionResults: CollectionValidationResult[] = [];
  
  Object.entries(COLLECTIONS).forEach(([key, baseName]) => {
    const environmentSpecificName = getCollectionName(baseName);
    const actualPrefix = extractPrefix(environmentSpecificName, baseName);
    const isCorrectlyPrefixed = actualPrefix === expectedPrefix;
    
    collectionResults.push({
      collectionName: key,
      baseCollectionName: baseName,
      environmentSpecificName,
      isCorrectlyPrefixed,
      expectedPrefix,
      actualPrefix
    });
    
    if (!isCorrectlyPrefixed) {
      errors.push(`Collection ${key} (${baseName}) has incorrect prefix. Expected: "${expectedPrefix}", Got: "${actualPrefix}"`);
    }
  });
  
  // Check for consistency across all collections
  const uniquePrefixes = [...new Set(collectionResults.map(r => r.actualPrefix))];
  if (uniquePrefixes.length > 1) {
    errors.push(`Inconsistent prefixes detected: ${uniquePrefixes.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
};

/**
 * Validate migration prerequisites
 */
export const validateMigrationPrerequisites = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Check if environment-aware Firebase config is available
  try {
    const { getFirebaseConfig } = require('./environmentConfig');
    const config = getFirebaseConfig();
    
    if (!config.projectId) {
      errors.push('Firebase project ID not configured');
    }
    
    if (!config.apiKey) {
      errors.push('Firebase API key not configured');
    }
    
    recommendations.push('Ensure separate Firebase project configurations are prepared for migration');
  } catch (error) {
    errors.push('Firebase configuration not accessible');
  }
  
  // Check for environment variable completeness
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_PID',
    'NEXT_PUBLIC_FIREBASE_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_DB_URL'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
  
  // Check for proper environment separation
  const context = getEnvironmentContext();
  if (context.type === 'development' && context.isVercel) {
    recommendations.push('Ensure Vercel dev deployments use development Firebase project after migration');
  }
  
  if (context.type === 'preview' && context.isVercel) {
    recommendations.push('Ensure Vercel preview deployments use production Firebase project after migration');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
};

/**
 * Generate migration documentation
 */
export const generateMigrationDocumentation = (): string => {
  const envType = getEnvironmentType();
  const context = getEnvironmentContext();
  
  return `
# Firebase Migration Documentation

## Current Architecture
- **Environment**: ${envType}
- **Context**: ${JSON.stringify(context, null, 2)}
- **Collection Prefix**: ${getExpectedPrefix(envType)}

## Migration Steps

### Phase 1: Preparation (Current)
1. ✅ Environment-aware collection helpers implemented
2. ✅ Centralized environment detection system
3. ✅ Firebase app initializer with multi-project support
4. ✅ Validation and testing utilities

### Phase 2: Separate Firebase Projects Setup
1. Create separate Firebase projects:
   - Development project for local and Vercel dev deployments
   - Production project for Vercel preview and production deployments

2. Update environment variables:
   - Add project-specific Firebase configurations
   - Update Vercel environment settings

3. Update Firebase configuration:
   - Modify getFirebaseConfig() to return project-specific configs
   - Remove collection prefixing logic
   - Test environment separation

### Phase 3: Migration Execution
1. Deploy updated configuration to staging
2. Validate data separation
3. Migrate existing data if needed
4. Deploy to production
5. Remove legacy prefixed collections

## Collection Mapping

### Current (Single Project with Prefixes)
${Object.entries(COLLECTIONS).map(([key, baseName]) => 
  `- ${key}: ${baseName} → ${getCollectionName(baseName)}`
).join('\n')}

### Future (Separate Projects)
${Object.entries(COLLECTIONS).map(([key, baseName]) => 
  `- ${key}: ${baseName} → ${baseName} (in appropriate project)`
).join('\n')}

## Environment Configuration

### Current Environment Variables
- NODE_ENV: ${process.env.NODE_ENV}
- VERCEL_ENV: ${process.env.VERCEL_ENV}
- Firebase Project: ${process.env.NEXT_PUBLIC_FIREBASE_PID}

### Required for Migration
- Separate Firebase project configurations
- Environment-specific deployment settings
- Data migration scripts (if needed)
`;
};

/**
 * Helper function to get expected prefix for environment
 */
function getExpectedPrefix(envType: string): string {
  switch (envType) {
    case 'production':
      return '';
    case 'preview':
      return 'PROD_';
    case 'development':
      return 'DEV_';
    default:
      return 'DEV_';
  }
}

/**
 * Helper function to extract prefix from collection name
 */
function extractPrefix(fullName: string, baseName: string): string {
  if (fullName === baseName) {
    return '';
  }
  return fullName.replace(baseName, '');
}

/**
 * Run comprehensive validation and log results
 */
export const runMigrationValidation = (): void => {
  console.log('🔍 Running Firebase Migration Validation...\n');
  
  const result = validateMigrationReadiness();
  
  if (result.isValid) {
    console.log('✅ Migration validation passed!');
  } else {
    console.log('❌ Migration validation failed!');
    console.log('\nErrors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  if (result.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    result.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  console.log('\n📋 Migration Documentation:');
  console.log(generateMigrationDocumentation());
};
