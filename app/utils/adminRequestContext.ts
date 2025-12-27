/**
 * Admin Request Context
 *
 * Uses AsyncLocalStorage to propagate the admin environment header through
 * synchronous function calls. This allows getCollectionName() to respect
 * the X-Force-Production-Data header without requiring async/await everywhere.
 *
 * Usage in API routes:
 *
 * import { withAdminContext } from '@/utils/adminRequestContext';
 *
 * export async function POST(request: NextRequest) {
 *   return withAdminContext(request, async () => {
 *     // All getCollectionName() calls inside here will respect the header
 *     const collection = getCollectionName('users'); // Works correctly!
 *   });
 * }
 */

import { AsyncLocalStorage } from 'async_hooks';
import { NextRequest } from 'next/server';

interface AdminRequestContextValue {
  forceProductionData: boolean;
  isAdminRoute: boolean;
}

// Create the AsyncLocalStorage instance
const adminRequestContext = new AsyncLocalStorage<AdminRequestContextValue>();

/**
 * Get the current admin request context
 * Returns undefined if not within a withAdminContext call
 */
export function getAdminRequestContext(): AdminRequestContextValue | undefined {
  return adminRequestContext.getStore();
}

/**
 * Check if we should use production collections based on the current request context
 * This is the key function that getCollectionName() uses
 */
export function shouldForceProductionFromContext(): boolean {
  const context = adminRequestContext.getStore();
  if (!context) return false;

  // Only respect the header if this is an admin route
  return context.forceProductionData && context.isAdminRoute;
}

/**
 * Wrap an API route handler to propagate the admin context
 * This makes getCollectionName() work correctly within the handler
 */
export function withAdminContext<T>(
  request: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  // Extract header value
  const forceProductionData = request.headers.get('x-force-production-data') === 'true';

  // Check if this is an admin route
  const pathname = request.nextUrl.pathname;
  const referer = request.headers.get('referer') || '';
  const isAdminRoute = pathname.startsWith('/api/admin/') ||
                       referer.includes('/admin/') ||
                       referer.includes('/admin');

  // Run the handler within the context
  return adminRequestContext.run(
    { forceProductionData, isAdminRoute },
    handler
  );
}

/**
 * Higher-order function to wrap an entire route handler
 * Use this for cleaner syntax:
 *
 * export const POST = withAdminContextHandler(async (request) => {
 *   // Handler code here
 * });
 */
export function withAdminContextHandler<T>(
  handler: (request: NextRequest) => Promise<T>
): (request: NextRequest) => Promise<T> {
  return (request: NextRequest) => {
    return withAdminContext(request, () => handler(request));
  };
}
