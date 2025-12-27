/**
 * Admin Request Context
 *
 * Provides a way to propagate the admin environment header through
 * synchronous function calls. This allows getCollectionName() to respect
 * the X-Force-Production-Data header.
 *
 * This module uses a simple global variable on the server side. It's safe
 * because each API route handler runs in its own isolated execution context
 * in Next.js (each request is handled synchronously before returning).
 *
 * For truly concurrent request handling, we'd need AsyncLocalStorage, but
 * in Next.js API routes, this simpler approach works because:
 * 1. Each API route handler runs to completion before handling the next request
 * 2. We set the context at the start and clear it at the end
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

interface AdminRequestContextValue {
  forceProductionData: boolean;
  isAdminRoute: boolean;
}

// Global context value - only used on the server
// This is safe in Next.js because API route handlers run synchronously
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const globalThis: { __adminRequestContext?: AdminRequestContextValue };

/**
 * Get the current admin request context
 * Returns undefined if not within a withAdminContext call
 */
export function getAdminRequestContext(): AdminRequestContextValue | undefined {
  // Only access on server side
  if (typeof window !== 'undefined') {
    return undefined;
  }
  return globalThis.__adminRequestContext;
}

/**
 * Check if we should use production collections based on the current request context
 * This is the key function that getCollectionName() uses
 */
export function shouldForceProductionFromContext(): boolean {
  const context = getAdminRequestContext();
  if (!context) return false;

  // Only respect the header if this is an admin route
  return context.forceProductionData && context.isAdminRoute;
}

/**
 * Wrap an API route handler to propagate the admin context
 * This makes getCollectionName() work correctly within the handler
 */
export async function withAdminContext<T>(
  request: { headers: { get: (name: string) => string | null }; nextUrl?: { pathname: string }; url?: string },
  handler: () => Promise<T>
): Promise<T> {
  // Only set context on the server
  if (typeof window !== 'undefined') {
    return handler();
  }

  // Extract header value
  const forceProductionData = request.headers.get('x-force-production-data') === 'true';

  // Check if this is an admin route
  const pathname = request.nextUrl?.pathname || (request.url ? new URL(request.url).pathname : '');
  const referer = request.headers.get('referer') || '';
  const isAdminRoute = pathname.startsWith('/api/admin/') ||
                       referer.includes('/admin/') ||
                       referer.includes('/admin');

  // Set the global context
  const previousContext = globalThis.__adminRequestContext;
  globalThis.__adminRequestContext = { forceProductionData, isAdminRoute };

  try {
    // Run the handler
    return await handler();
  } finally {
    // Restore previous context (or clear it)
    if (previousContext) {
      globalThis.__adminRequestContext = previousContext;
    } else {
      delete globalThis.__adminRequestContext;
    }
  }
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
  handler: (request: { headers: { get: (name: string) => string | null }; nextUrl?: { pathname: string }; url?: string }) => Promise<T>
): (request: { headers: { get: (name: string) => string | null }; nextUrl?: { pathname: string }; url?: string }) => Promise<T> {
  return (request) => {
    return withAdminContext(request, () => handler(request));
  };
}
