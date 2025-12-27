/**
 * Algolia Status API - Admin endpoint to check Algolia configuration
 *
 * Returns the current Algolia configuration status for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getAlgoliaIndexName, ALGOLIA_INDICES, logAlgoliaConfig } from '../../../lib/algolia';
import { getEnvironmentType, getEnvironmentPrefix } from '../../../utils/environmentConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin access using session cookie
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error || 'Admin access required' }, { status: 403 });
    }

    // Get configuration info
    const envType = getEnvironmentType();
    const prefix = getEnvironmentPrefix();
    const pagesIndex = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);
    const usersIndex = getAlgoliaIndexName(ALGOLIA_INDICES.USERS);

    // Check environment variables (don't expose actual values)
    const hasAppId = !!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
    const hasSearchKey = !!process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
    const hasAdminKey = !!process.env.ALGOLIA_ADMIN_KEY;

    // Log to server console for debugging
    console.log('[Algolia Status] Checking configuration...');
    logAlgoliaConfig();

    return NextResponse.json({
      success: true,
      environment: {
        type: envType,
        prefix: prefix || '(none)',
      },
      indices: {
        pages: pagesIndex,
        users: usersIndex,
      },
      credentials: {
        NEXT_PUBLIC_ALGOLIA_APP_ID: hasAppId,
        NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: hasSearchKey,
        ALGOLIA_ADMIN_KEY: hasAdminKey,
      },
      canWrite: hasAppId && hasAdminKey,
      message: hasAdminKey
        ? 'Algolia admin key is configured - writes should work'
        : 'ALGOLIA_ADMIN_KEY is NOT set - writes will fail!',
    });
  } catch (error) {
    console.error('[Algolia Status] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
