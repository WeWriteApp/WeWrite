/**
 * Internal API Utility
 *
 * Provides safe internal API calls with URL validation
 * to prevent SSRF (Server-Side Request Forgery) attacks.
 */

// Allowed domains for internal API calls
const ALLOWED_INTERNAL_HOSTS = [
  'localhost',
  '127.0.0.1',
  'getwewrite.app',
  'www.getwewrite.app',
  'api.wewrite.app',
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Get the validated internal API base URL
 * Returns null if the URL is not from an allowed host
 */
export function getInternalApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const url = new URL(baseUrl);

    // Validate protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      console.error('[Security] Invalid protocol in NEXT_PUBLIC_BASE_URL:', url.protocol);
      return 'http://localhost:3000';
    }

    // Validate host
    const host = url.hostname.toLowerCase();
    const isAllowed = ALLOWED_INTERNAL_HOSTS.some(
      (allowed) => host === allowed || host.endsWith('.' + allowed)
    );

    if (!isAllowed) {
      console.error('[Security] NEXT_PUBLIC_BASE_URL has unauthorized host:', host);
      return 'http://localhost:3000';
    }

    return baseUrl;
  } catch (error) {
    console.error('[Security] Invalid NEXT_PUBLIC_BASE_URL:', error);
    return 'http://localhost:3000';
  }
}

/**
 * Make a safe internal API fetch call
 * Validates the URL before making the request
 */
export async function internalApiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const baseUrl = getInternalApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Request': 'true',
      ...options?.headers,
    },
  });
}

/**
 * Invalidate a specific cache endpoint
 * Common internal operation that needs SSRF protection
 */
export async function invalidateCache(
  endpoint: string,
  body: Record<string, unknown>
): Promise<void> {
  try {
    await internalApiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate ${endpoint}:`, error);
    // Don't throw - cache invalidation failure shouldn't break the main operation
  }
}
