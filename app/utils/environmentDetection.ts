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
 */
export const isVercelDeployment = (): boolean => {
  return !!(process.env.VERCEL || process.env.VERCEL_ENV);
};

/**
 * Detect if we're running locally
 */
export const isLocalDevelopment = (): boolean => {
  return !isVercelDeployment() && process.env.NODE_ENV === 'development';
};

/**
 * Get the current environment type with detailed detection logic
 * 
 * Environment Detection Rules:
 * 1. VERCEL_ENV=production → production (Vercel production deployment)
 * 2. VERCEL_ENV=preview → preview (Vercel preview deployment)
 * 3. VERCEL_ENV=development → development (Vercel dev deployment)
 * 4. NODE_ENV=development + no VERCEL_ENV → development (local development)
 * 5. Default → development (safe fallback)
 */
export const detectEnvironmentType = (): EnvironmentType => {
  // Check Vercel environment first (most specific)
  if (process.env.VERCEL_ENV === 'production') {
    return 'production';
  }
  
  if (process.env.VERCEL_ENV === 'preview') {
    return 'preview';
  }
  
  if (process.env.VERCEL_ENV === 'development') {
    return 'development';
  }
  
  // Check Node.js environment for local development
  if (process.env.NODE_ENV === 'development' && !isVercelDeployment()) {
    return 'development';
  }
  
  // Production fallback for NODE_ENV=production without VERCEL_ENV
  if (process.env.NODE_ENV === 'production' && !isVercelDeployment()) {
    return 'production';
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
  
  return {
    type,
    isClient,
    isServer,
    isVercel,
    isLocal,
    nodeEnv,
    vercelEnv
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
  
  console.log('[Environment Detection] Context:', {
    type: context.type,
    isClient: context.isClient,
    isServer: context.isServer,
    isVercel: context.isVercel,
    isLocal: context.isLocal,
    nodeEnv: context.nodeEnv,
    vercelEnv: context.vercelEnv
  });
  
  if (!validation.isValid) {
    console.error('[Environment Detection] Validation failed:', validation.warnings);
  } else if (validation.warnings.length > 0) {
    console.warn('[Environment Detection] Warnings:', validation.warnings);
  } else {
    console.log('[Environment Detection] ✅ All checks passed');
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
