/**
 * Debug Endpoint Security Helper
 *
 * All debug endpoints should use this to restrict access to development only.
 * This prevents sensitive debugging information from being exposed in production.
 */

import { NextResponse } from 'next/server';

/**
 * Check if the current environment is development.
 * Returns true for local development only, NOT for production or preview.
 */
export function isDevelopmentEnvironment(): boolean {
  // Only allow in local development
  // VERCEL_ENV is set on Vercel deployments (production, preview)
  // So we only allow when NODE_ENV is development AND there's no VERCEL_ENV
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
  return isLocalDev;
}

/**
 * Returns a 403 response if not in development environment.
 * Use this at the start of every debug endpoint handler.
 *
 * @returns NextResponse with 403 if not development, or null if development (safe to proceed)
 */
export function requireDevelopmentEnvironment(): NextResponse | null {
  if (!isDevelopmentEnvironment()) {
    return NextResponse.json(
      {
        error: 'Debug endpoints are only available in local development',
        note: 'This endpoint is disabled in production and preview environments'
      },
      { status: 403 }
    );
  }
  return null;
}
