/**
 * CSRF Token API Endpoint
 *
 * Provides CSRF tokens for client-side requests.
 * Clients should call this endpoint to get a token, then include it
 * in the X-CSRF-Token header for all state-changing requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCsrfToken } from '../../../utils/csrfProtection';
import { getUserIdFromRequest } from '../../auth-helper';

/**
 * GET /api/auth/csrf-token
 *
 * Returns a CSRF token for the authenticated user.
 * The token is also set as an httpOnly cookie.
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication for CSRF tokens
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create CSRF token (also sets cookie)
    const token = await getOrCreateCsrfToken();

    return NextResponse.json({
      success: true,
      token,
      message: 'Include this token in the X-CSRF-Token header for state-changing requests'
    });

  } catch (error) {
    console.error('[CSRF] Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
