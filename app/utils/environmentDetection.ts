/**
 * Environment Detection Utility
 * 
 * Provides reliable environment detection for both client and server contexts.
 * This module ensures consistent environment identification across the entire application
 * and supports the future migration to separate Firebase projects.
 */

/**
 * Environment types supported by the application
 */
export type EnvironmentType = 'production' | 'preview' | 'development';

/**
 * Environment context information
 */
export interface EnvironmentContext {
  type: EnvironmentType;
  isClient: boolean;
  isServer: boolean;
  isVercel: boolean;
  isLocal: boolean;
  nodeEnv: string;
  vercelEnv?: string;
  gitBranch?: string;
}

/**
 * Detect if we're running in a client context
 */
export const isClientSide = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Detect if we're running in a server context
 */
export const isServerSide = (): boolean => {
  return typeof window === 'undefined';
};

/**
 * Detect if we're running on Vercel
 * Only return true if we're actually deployed on Vercel, not just with VERCEL_ENV set locally
 */
export const isVercelDeployment = (): boolean => {
  return !!(process.env.VERCEL || process.env.VERCEL_URL);
};

/**
 * Detect if we're running locally
 */
export const isLocalDevelopment = (): boolean => {
  return !isVercelDeployment() && process.env.NODE_ENV === 'development';
};

/**
 * Get the current git branch (server-side only)
 */
export const getCurrentGitBranch = (): string | null => {
  // Only available server-side
  if (isClientSide()) {
    return null;
  }

  try {
    // Try to get branch from Vercel environment variable first
    if (process.env.VERCEL_GIT_COMMIT_REF) {
      return process.env.VERCEL_GIT_COMMIT_REF;
    }

    // Fallback to checking git locally (for local development, server-side only)
    if (typeof window === 'undefined') {
      try {
        const { execSync } = require('child_process');
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        return branch;
      } catch (gitError) {
        console.warn('[Environment Detection] Git command failed:', gitError);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.warn('[Environment Detection] Could not determine git branch:', error);
    return null;
  }
};

/**
 * Get the current environment type with detailed detection logic
 *
 * NEW Environment Detection Rules:
 * 1. VERCEL_ENV=production → production (Vercel production deployment)
 * 2. VERCEL_ENV=preview → preview (Vercel preview deployment)
 * 3. Local development (any branch) → development (use DEV_ collections)
 * 4. VERCEL_ENV=development → development (Vercel dev deployment, fallback)
 * 5. Default → development (safe fallback)
 *
 * Key Changes:
 * - localhost always uses DEV_ collections regardless of branch
 * - Vercel deployments (dev/main branches) use production collections
 * - This allows testing production data on Vercel previews before pushing to main
 */
export const detectEnvironmentType = (): EnvironmentType => {
  // Check Vercel production/preview first (most specific)
  if (process.env.VERCEL_ENV === 'production') {
    return 'production';
  }

  if (process.env.VERCEL_ENV === 'preview') {
    return 'preview';
  }

  // NEW LOGIC: All localhost development uses DEV_ collections
  // This ensures clean separation between local dev and production data
  if (isLocalDevelopment()) {
    const branch = getCurrentGitBranch();
    // Local development detected - using DEV_ collections
    return 'development';
  }

  // Fallback: Vercel development deployment
  if (process.env.VERCEL_ENV === 'development') {
    return 'development';
  }

  // IMPORTANT: Local production builds (next build && next start) should still use DEV_ collections
  // Only actual Vercel production deployments should use production collections
  // This prevents accidentally contaminating production data when testing locally
  if (process.env.NODE_ENV === 'production' && !isVercelDeployment()) {
    // Local production build - use development collections for safety
    console.warn('[Environment Detection] Local production build detected - using DEV_ collections for safety');
    return 'development';
  }

  // Safe default to development to prevent production data contamination
  return 'development';
};

/**
 * Get comprehensive environment context
 */
export const getEnvironmentContext = (): EnvironmentContext => {
  const type = detectEnvironmentType();
  const isClient = isClientSide();
  const isServer = isServerSide();
  const isVercel = isVercelDeployment();
  const isLocal = isLocalDevelopment();
  const nodeEnv = process.env.NODE_ENV || 'development';
  const vercelEnv = process.env.VERCEL_ENV;
  const gitBranch = getCurrentGitBranch() || undefined;

  return {
    type,
    isClient,
    isServer,
    isVercel,
    isLocal,
    nodeEnv,
    vercelEnv,
    gitBranch
  };
};

/**
 * Validate environment configuration consistency
 */
export const validateEnvironmentDetection = (): { isValid: boolean; warnings: string[] } => {
  const context = getEnvironmentContext();
  const warnings: string[] = [];
  let isValid = true;
  
  // Check for inconsistent environment variables
  if (context.vercelEnv && context.nodeEnv) {
    if (context.vercelEnv === 'production' && context.nodeEnv !== 'production') {
      warnings.push(`VERCEL_ENV is 'production' but NODE_ENV is '${context.nodeEnv}'`);
    }
    
    if (context.vercelEnv === 'development' && context.nodeEnv === 'production') {
      warnings.push(`VERCEL_ENV is 'development' but NODE_ENV is 'production'`);
    }
  }
  
  // Check for missing environment variables in Vercel deployments
  if (context.isVercel && !context.vercelEnv) {
    warnings.push('Running on Vercel but VERCEL_ENV is not set');
    isValid = false;
  }
  
  // Check for local development setup
  if (context.isLocal && context.nodeEnv !== 'development') {
    warnings.push(`Local development detected but NODE_ENV is '${context.nodeEnv}'`);
  }
  
  return { isValid, warnings };
};

/**
 * Log environment detection information for debugging
 */
export const logEnvironmentDetection = (): void => {
  const context = getEnvironmentContext();
  const validation = validateEnvironmentDetection();
  
  // Only log environment detection on errors or when explicitly debugging
  if (!validation.isValid) {
    console.error('[Environment Detection] Validation failed:', validation.warnings);
  } else if (validation.warnings.length > 0) {
    console.warn('[Environment Detection] Warnings:', validation.warnings);
  } else if (process.env.ENV_DEBUG === 'true') {
    console.log('[Environment Detection] Context:', {
      type: context.type,
      isClient: context.isClient,
      isServer: context.isServer,
      isVercel: context.isVercel,
      isLocal: context.isLocal,
      nodeEnv: context.nodeEnv,
      vercelEnv: context.vercelEnv,
      gitBranch: context.gitBranch
    });
  }
};

/**
 * Get environment-specific configuration values
 */
export const getEnvironmentConfig = () => {
  const context = getEnvironmentContext();
  
  return {
    // Database configuration
    useFirebaseEmulator: context.isLocal && process.env.USE_FIREBASE_EMULATOR === 'true',
    enableAnalytics: context.type === 'production',
    enableDebugLogging: context.type === 'development',
    
    // API configuration
    apiTimeout: context.type === 'production' ? 30000 : 60000,
    enableCaching: context.type === 'production',
    
    // Security configuration
    enableStrictMode: context.type === 'production',
    allowTestData: context.type === 'development',
    
    // Performance configuration
    enableOptimizations: context.type === 'production',
    enableProfiling: context.type === 'development'
  };
};

/**
 * Check if current environment allows specific operations
 */
export const environmentAllows = {
  testDataAccess: () => getEnvironmentContext().type === 'development',
  productionDataAccess: () => getEnvironmentContext().type === 'production',
  previewDataAccess: () => getEnvironmentContext().type === 'preview',
  debugOperations: () => getEnvironmentContext().type !== 'production',
  analyticsCollection: () => getEnvironmentContext().type === 'production',
  experimentalFeatures: () => getEnvironmentContext().type === 'development'
};
