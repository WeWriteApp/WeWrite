/**
 * Convert Unfunded Tokens API
 * 
 * Converts unfunded token allocations to funded tokens when a user activates their subscription.
 * This endpoint is called automatically when a subscription becomes active.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { convertSimulatedToRealTokens } from '../../../utils/simulatedTokens';
import { ServerTokenService } from '../../../services/tokenService.server';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId: requestUserId } = body;

    // Validate user matches authenticated user
    if (requestUserId && requestUserId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    console.log(`[CONVERT UNFUNDED] Converting unfunded tokens for user ${userId}`);

    // Define the allocation function that will be used to convert tokens
    const allocateTokensFunction = async (pageId: string, tokens: number): Promise<boolean> => {
      try {
        // Get the page to find the recipient user ID
        const pageData = await getPageData(pageId);
        if (!pageData) {
          console.warn(`[CONVERT UNFUNDED] Page ${pageId} not found, skipping allocation`);
          return false;
        }

        // Allocate tokens using the server token service
        const result = await ServerTokenService.allocateTokens(
          userId,
          pageData.userId, // recipient is the page owner
          'page',
          pageId,
          tokens
        );

        return result.success;
      } catch (error) {
        console.error(`[CONVERT UNFUNDED] Error allocating tokens to page ${pageId}:`, error);
        return false;
      }
    };

    // Convert unfunded tokens to real token allocations
    const conversionResult = await convertSimulatedToRealTokens(userId, allocateTokensFunction);

    console.log(`[CONVERT UNFUNDED] Conversion completed for user ${userId}:`, {
      success: conversionResult.success,
      convertedCount: conversionResult.convertedCount,
      errorCount: conversionResult.errors.length
    });

    return NextResponse.json({
      success: true,
      convertedCount: conversionResult.convertedCount,
      errors: conversionResult.errors,
      message: conversionResult.convertedCount > 0 
        ? `Successfully converted ${conversionResult.convertedCount} unfunded token allocations to funded tokens`
        : 'No unfunded tokens to convert'
    });

  } catch (error) {
    console.error('Error converting unfunded tokens:', error);
    return NextResponse.json(
      { error: 'Failed to convert unfunded tokens' },
      { status: 500 }
    );
  }
}

/**
 * Get page data to find the owner
 */
async function getPageData(pageId: string): Promise<{ userId: string } | null> {
  try {
    const admin = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../utils/environmentConfig');
    
    const firebaseAdmin = admin.getFirebaseAdmin();
    const db = firebaseAdmin.firestore();
    
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    
    if (!pageDoc.exists) {
      return null;
    }
    
    const pageData = pageDoc.data();
    return {
      userId: pageData?.userId
    };
  } catch (error) {
    console.error('Error getting page data:', error);
    return null;
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to convert unfunded tokens.' },
    { status: 405 }
  );
}
