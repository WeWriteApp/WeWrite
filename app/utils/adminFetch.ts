/**
 * Admin Fetch Utility
 *
 * Wraps fetch to add the X-Force-Production-Data header when admin has selected
 * production data source. This allows admin tools to work with production data
 * in local development.
 */

export const ADMIN_DATA_STORAGE_KEY = 'wewrite_admin_data_source';

/**
 * Determine the default data source based on the current environment.
 * - In production/preview deployments: default to 'production'
 * - In local development: default to 'dev'
 */
function getEnvironmentDefault(): 'dev' | 'production' {
  if (typeof window === 'undefined') return 'dev';
  // Check if we're on a Vercel deployment
  const hostname = window.location.hostname;
  const isVercelDeployment = hostname.includes('vercel.app') || hostname === 'wewrite.app' || hostname.endsWith('.wewrite.app');
  if (isVercelDeployment) {
    return 'production';
  }
  // Local development defaults to dev
  return 'dev';
}

/**
 * Check if admin has selected production data source
 */
export function isAdminProductionMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(ADMIN_DATA_STORAGE_KEY);
  // If explicitly set, use that value
  if (stored === 'production') return true;
  if (stored === 'dev') return false;
  // Otherwise use environment default
  return getEnvironmentDefault() === 'production';
}

/**
 * Get the current admin data source
 */
export function getAdminDataSource(): 'dev' | 'production' {
  if (typeof window === 'undefined') return 'dev';
  const stored = localStorage.getItem(ADMIN_DATA_STORAGE_KEY);
  if (stored === 'production' || stored === 'dev') return stored;
  // Return environment default if no explicit preference
  return getEnvironmentDefault();
}

/**
 * Fetch wrapper that adds production data header when in admin production mode
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (isAdminProductionMode()) {
    headers.set('X-Force-Production-Data', 'true');
  }

  return fetch(input, { ...init, headers });
}

/**
 * JSON fetch helper for admin API calls
 */
export async function adminFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await adminFetch(input, init);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
